import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Slide, SlideComment, CommentField, AgentSession } from '../types';
import { AGENT_SESSION_IDLE, toTargetElement, type CommentWebhookContext } from '../types';
import {
  AgentApiError,
  fetchAgentRun,
  fetchSlideSourceFields,
  startAgentReview,
} from '../lib/agent-api';
import { applySourcePatchToSlide } from '../lib/deck-sync';
import { buildAgentDetailText, traceFieldsFromRun } from '../lib/agent-run-ui';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 660_000;

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
        } else if (run.phase === 'completed' && run.result?.applied) {
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
        } else if (run.phase === 'completed' || run.phase === 'error') {
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

  const agentBusy =
    agentSession.status === 'queued' ||
    agentSession.status === 'thinking' ||
    agentSession.status === 'streaming';

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
    agentBusy,
  };
}
