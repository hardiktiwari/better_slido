import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  Slide,
  SlideComment,
  CommentField,
  AgentSession,
  SlideFieldDiff,
  PendingReview,
  BulletItem,
  PollOption,
} from '../types';
import { AGENT_SESSION_IDLE, toTargetElement, type CommentWebhookContext } from '../types';
import {
  AgentApiError,
  acceptAgentRun as apiAcceptAgentRun,
  fetchAgentRun,
  fetchSlideSourceFields,
  rejectAgentRun as apiRejectAgentRun,
  startAgentReview,
  type SlideFieldsSnapshot,
} from '../lib/agent-api';
import { applySourcePatchToSlide } from '../lib/deck-sync';
import { buildAgentDetailText, traceFieldsFromRun } from '../lib/agent-run-ui';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 660_000;

/** True when a comment should immediately queue Cursor CLI on the slide. */
export function commentMentionsAgent(comment: Pick<SlideComment, 'body' | 'mentions'>): boolean {
  return (
    comment.mentions.some((m) => m.toLowerCase() === '@agent') || /@agent\b/i.test(comment.body)
  );
}

/** True while a slide is in pending-review mode — HMR resync must skip these slides. */
const reviewLockedSlides = new Set<string>();
export function isSlideAwaitingReview(slideId: string): boolean {
  return reviewLockedSlides.has(slideId);
}

const TEXT_FIELDS = ['tag', 'title', 'subtitle', 'footerLeft', 'footerRight'] as const;
const CLASS_FIELDS = ['bulletTextClass', 'subtitleClass'] as const;
const IMAGE_FIELDS = ['imageUrl'] as const;

function arrayShallowEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Build the field-level diff list between two slide snapshots. */
export function buildSlideDiff(
  before: SlideFieldsSnapshot | undefined,
  after: SlideFieldsSnapshot | undefined,
): SlideFieldDiff[] {
  if (!after) return [];
  const diffs: SlideFieldDiff[] = [];
  const pre = before ?? {};

  for (const f of TEXT_FIELDS) {
    if (after[f] !== undefined && after[f] !== pre[f]) {
      diffs.push({ field: f, kind: 'text', before: pre[f], after: after[f] });
    }
  }
  for (const f of CLASS_FIELDS) {
    if (after[f] !== undefined && after[f] !== pre[f]) {
      diffs.push({ field: f, kind: 'class', before: pre[f], after: after[f] });
    }
  }
  for (const f of IMAGE_FIELDS) {
    if (after[f] !== undefined && after[f] !== pre[f]) {
      diffs.push({ field: f, kind: 'image', before: pre[f], after: after[f] });
    }
  }
  if (after.bullets && !arrayShallowEqual(pre.bullets as BulletItem[] | undefined, after.bullets)) {
    diffs.push({ field: 'bullets', kind: 'bullets', before: pre.bullets, after: after.bullets });
  }
  if (
    after.pollOptions &&
    !arrayShallowEqual(pre.pollOptions as PollOption[] | undefined, after.pollOptions)
  ) {
    diffs.push({
      field: 'pollOptions',
      kind: 'pollOptions',
      before: pre.pollOptions,
      after: after.pollOptions,
    });
  }
  return diffs;
}

interface UseAgentReviewOptions {
  deck: Slide[];
  currentSlideIndex: number;
  comments: SlideComment[];
  setComments: Dispatch<SetStateAction<SlideComment[]>>;
  setDeck: Dispatch<SetStateAction<Slide[]>>;
  mergeSlidesFromDefaults: (slides: Slide[]) => Slide[];
}

export function useAgentReview({
  deck,
  currentSlideIndex,
  comments,
  setComments,
  setDeck,
  mergeSlidesFromDefaults,
}: UseAgentReviewOptions) {
  const [agentSession, setAgentSession] = useState<AgentSession>(AGENT_SESSION_IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const syncDeckFromSource = useCallback(
    async (slideId: string) => {
      const patch = await fetchSlideSourceFields(slideId);
      if (patch && Object.keys(patch).length > 0) {
        setDeck((prev) =>
          prev.map((s) =>
            s.id === slideId ? applySourcePatchToSlide(s, patch as Partial<Slide>) : s,
          ),
        );
        return;
      }
      setDeck((prev) => mergeSlidesFromDefaults(prev));
    },
    [mergeSlidesFromDefaults, setDeck],
  );

  const pollUntilDone = useCallback(
    async (runId: string, slideId: string, commentIds: string[], signal: AbortSignal) => {
      const started = Date.now();
      let poll404Retries = 0;

      for (;;) {
        if (signal.aborted) return;
        if (Date.now() - started > POLL_MAX_MS) {
          setAgentSession({
            status: 'error',
            streamingText: '',
            proposedOps: [],
            errorMessage: 'Agent run timed out (11 min). See logs/last-agent-trace.json.',
          });
          return;
        }

        let run;
        try {
          run = await fetchAgentRun(runId, signal);
          poll404Retries = 0;
        } catch (err) {
          if (err instanceof AgentApiError && err.status === 404 && poll404Retries < 3) {
            poll404Retries += 1;
            setAgentSession((p) => ({
              ...p,
              status: 'queued',
              streamingText: `Reconnecting to agent run (${poll404Retries}/3)…`,
            }));
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            continue;
          }
          const msg = err instanceof Error ? err.message : String(err);
          setAgentSession((p) => ({ ...p, status: 'error', errorMessage: msg }));
          return;
        }

        const trace = traceFieldsFromRun(run);

        if (run.phase === 'queued') {
          setAgentSession((p) => ({
            ...p,
            status: 'queued',
            ...trace,
            streamingText: buildAgentDetailText(trace) || 'Waiting in agent queue…',
          }));
        } else if (run.phase === 'running') {
          const detail = buildAgentDetailText(trace);
          const hasStream = Boolean(trace.reasoning?.trim());
          setAgentSession((p) => ({
            ...p,
            status: hasStream ? 'streaming' : 'thinking',
            ...trace,
            streamingText:
              detail ||
              (trace.subagent
                ? `Running ${trace.subagent} subagent on src/App.tsx…`
                : 'Cursor agent is editing src/App.tsx…'),
          }));
        } else if (run.phase === 'awaiting_review' && run.result?.applied) {
          // Suggest-before-apply: lock the slide, show the diff, do NOT touch deck state yet.
          reviewLockedSlides.add(slideId);
          const diffs = buildSlideDiff(run.result.preFields, run.result.postFields);
          const pending: PendingReview = {
            runId,
            slideId,
            commentIds,
            diffs,
            explanation: run.result.explanation,
          };
          setAgentSession({
            status: 'review',
            streamingText: '',
            proposedOps: [],
            pendingReview: pending,
          });
          return;
        } else if (run.phase === 'completed' && run.result?.applied) {
          // Legacy path (older runs without preFields/postFields). Sync as before.
          await syncDeckFromSource(slideId);
          setDeck((prev) => mergeSlidesFromDefaults(prev));
          if (commentIds.length > 0) {
            const resolved = new Set(commentIds);
            setComments((prev) =>
              prev.map((c) => (resolved.has(c.id) ? { ...c, resolved: true } : c)),
            );
          }
          const explanation = run.result.explanation ?? 'Agent applied changes to src/App.tsx.';
          setAgentSession({
            status: 'applied',
            ...trace,
            streamingText: buildAgentDetailText(trace, explanation) || explanation,
            proposedOps: [],
            appliedChangeCount: commentIds.length,
          });
          return;
        } else if (run.phase === 'completed' || run.phase === 'error' || run.phase === 'rejected') {
          const explanation =
            run.error ??
            run.result?.explanation ??
            'Agent finished without applying changes.';
          setAgentSession({
            status: 'error',
            ...trace,
            streamingText:
              buildAgentDetailText(trace, explanation) ||
              (run.result?.cliLogs ?? []).join('\n'),
            proposedOps: [],
            errorMessage: explanation,
          });
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    },
    [mergeSlidesFromDefaults, setComments, setDeck, syncDeckFromSource],
  );

  const applySlideReview = useCallback(
    async (slideId: string, pendingOverride?: SlideComment[]) => {
      const pending =
        pendingOverride ?? comments.filter((c) => c.slideId === slideId && !c.resolved);
      if (pending.length === 0) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const slideIndex = deck.findIndex((s) => s.id === slideId);
      const slide = slideIndex >= 0 ? deck[slideIndex] : deck[currentSlideIndex];
      const primaryField = pending[0].field;
      const targetElement = toTargetElement(primaryField);
      const commentIds = pending.map((c) => c.id);

      const context: CommentWebhookContext = {
        slideIndex: slideIndex >= 0 ? slideIndex : currentSlideIndex,
        field: primaryField,
        targetElement,
        slide: {
          id: slide.id,
          type: slide.type,
          tag: slide.tag,
          title: slide.title,
          subtitle: slide.subtitle,
          bullets: slide.bullets,
          pollOptions: slide.pollOptions,
          footerLeft: slide.footerLeft,
          footerRight: slide.footerRight,
          bulletTextClass: slide.bulletTextClass,
          imageUrl: slide.imageUrl,
        },
      };

      setAgentSession({
        status: 'queued',
        streamingText: `Sending ${pending.length} comment(s) to the agent…`,
        proposedOps: [],
      });

      try {
        const { runId } = await startAgentReview({
          slideId,
          comments: pending.map((c) => ({ id: c.id, field: c.field, body: c.body })),
          targetElement,
          context,
        });
        await pollUntilDone(runId, slideId, commentIds, abort.signal);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : String(err);
        setAgentSession((p) => ({ ...p, status: 'error', errorMessage: msg }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [comments, currentSlideIndex, deck, pollUntilDone],
  );

  const cancelAgent = useCallback(() => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    setAgentSession(AGENT_SESSION_IDLE);
  }, []);

  const acceptPendingReview = useCallback(async () => {
    const pending = agentSession.pendingReview;
    if (!pending) return;
    try {
      await apiAcceptAgentRun(pending.runId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAgentSession((p) => ({ ...p, status: 'error', errorMessage: msg }));
      return;
    }
    reviewLockedSlides.delete(pending.slideId);
    await syncDeckFromSource(pending.slideId);
    setDeck((prev) => mergeSlidesFromDefaults(prev));
    if (pending.commentIds.length > 0) {
      const resolved = new Set(pending.commentIds);
      setComments((prev) => prev.map((c) => (resolved.has(c.id) ? { ...c, resolved: true } : c)));
    }
    setAgentSession({
      status: 'applied',
      streamingText:
        pending.explanation ?? `Applied ${pending.diffs.length} suggested change(s).`,
      proposedOps: [],
      appliedChangeCount: pending.commentIds.length,
    });
  }, [agentSession.pendingReview, mergeSlidesFromDefaults, setComments, setDeck, syncDeckFromSource]);

  const rejectPendingReview = useCallback(async () => {
    const pending = agentSession.pendingReview;
    if (!pending) return;
    try {
      await apiRejectAgentRun(pending.runId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAgentSession((p) => ({ ...p, status: 'error', errorMessage: msg }));
      return;
    }
    reviewLockedSlides.delete(pending.slideId);
    // Clean transaction: drop the comment that triggered this run so the slide
    // isn't left with a stale prompt lingering after a reject.
    if (pending.commentIds.length > 0) {
      const dropped = new Set(pending.commentIds);
      setComments((prev) => prev.filter((c) => !dropped.has(c.id)));
    }
    setAgentSession({
      status: 'idle',
      streamingText: '',
      proposedOps: [],
    });
  }, [agentSession.pendingReview, setComments]);

  /**
   * Roll back the current suggestion and re-run the agent with a brand new
   * single-comment prompt. Replaces (not appends to) the prior comment so the
   * agent only ever sees one instruction at a time.
   */
  const refinePendingReview = useCallback(
    async (followUpText: string) => {
      const pending = agentSession.pendingReview;
      const text = followUpText.trim();
      if (!pending || !text) return;

      // 1. Roll the file back so the new run starts from a clean slide.
      try {
        await apiRejectAgentRun(pending.runId);
      } catch {
        /* best-effort: even if revert fails (e.g. snapshot already taken), continue */
      }
      reviewLockedSlides.delete(pending.slideId);

      // 2. Re-use the field from the original triggering comment (fallback to 'slide').
      const triggeringComment = comments.find((c) => pending.commentIds.includes(c.id));
      const field: CommentField = triggeringComment?.field ?? 'slide';

      const mentions = Array.from(
        new Set<string>((text.match(/@\w+/g) ?? []).map((m) => m.toLowerCase())),
      );
      const newComment: SlideComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        slideId: pending.slideId,
        field,
        author: 'Presenter',
        body: text,
        resolved: false,
        createdAt: Date.now(),
        mentions,
      };

      // 3. REPLACE the prior triggering comment(s) with the new one, then run
      //    the agent against just the new comment (no thread accumulation).
      const dropped = new Set(pending.commentIds);
      setComments((prev) => {
        const next = [newComment, ...prev.filter((c) => !dropped.has(c.id))];
        queueMicrotask(() => void applySlideReview(pending.slideId, [newComment]));
        return next;
      });

      setAgentSession({
        status: 'queued',
        streamingText: 'Re-running with your refined prompt…',
        proposedOps: [],
      });
    },
    [agentSession.pendingReview, applySlideReview, comments, setComments],
  );

  const agentBusy =
    agentSession.status === 'queued' ||
    agentSession.status === 'thinking' ||
    agentSession.status === 'streaming' ||
    agentSession.status === 'review';

  useEffect(() => {
    if (agentSession.status !== 'applied') return;
    const hasDetail = Boolean(agentSession.reasoning || agentSession.subagent);
    const t = setTimeout(() => setAgentSession(AGENT_SESSION_IDLE), hasDetail ? 12_000 : 4000);
    return () => clearTimeout(t);
  }, [agentSession.status, agentSession.reasoning, agentSession.subagent]);

  return {
    agentSession,
    applySlideReview,
    cancelAgent,
    acceptPendingReview,
    rejectPendingReview,
    refinePendingReview,
    agentBusy,
  };
}
