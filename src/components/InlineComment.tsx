import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Bot, Loader2, Check, AlertCircle, RefreshCcw } from 'lucide-react';
import type {
  AgentSession,
  BulletItem,
  CommentField,
  PollOption,
  SlideComment,
  SlideFieldDiff,
} from '../types';

interface CommentAnchorProps {
  slideId: string;
  field: CommentField;
  comments: SlideComment[];
  onAddComment: (comment: Omit<SlideComment, 'id' | 'createdAt'>) => void;
  onResolveComment: (id: string) => void;
  /** Agent session (so the popover can show drafting / review / error inline). */
  agentSession?: AgentSession;
  /** Apply the suggested edits to the slide. */
  onAcceptReview?: () => Promise<void> | void;
  /** Roll back the suggestion and drop the triggering comment. */
  onRejectReview?: () => Promise<void> | void;
  agentBusy?: boolean;
  cursorCliReady?: boolean;
  authorName?: string;
  /**
   * 'badge' (default): show the small corner badge that opens the popover.
   * 'children': hide the badge; clicking the wrapped children opens the popover instead.
   */
  trigger?: 'badge' | 'children';
  children: React.ReactNode;
}

const RUNNING_STATUSES = new Set(['queued', 'thinking', 'streaming']);

/**
 * Comment popover that drives the entire workflow:
 *   1. type comment → Process
 *   2. agent drafts → spinner inline
 *   3. review diff → Save / Discard / Refine
 * All in one place. The popover refuses to close while a run is in flight or
 * awaiting review, so the suggestion can't get orphaned by an accidental click-away.
 */
export function CommentAnchor({
  slideId,
  field,
  comments,
  onAddComment,
  onResolveComment,
  agentSession,
  onAcceptReview,
  onRejectReview,
  cursorCliReady = true,
  authorName = 'Presenter',
  trigger = 'badge',
  children,
}: CommentAnchorProps) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const unresolved = comments.filter((c) => !c.resolved);
  const hasComments = unresolved.length > 0;

  const status = agentSession?.status ?? 'idle';
  const pending = agentSession?.pendingReview;
  const reviewForThisSlide = status === 'review' && pending?.slideId === slideId;
  const runningForThisSlide =
    RUNNING_STATUSES.has(status) && (!pending || pending.slideId === slideId) && hasComments;
  const errorForThisSlide = status === 'error' && hasComments;
  const lockedOpen = runningForThisSlide || reviewForThisSlide;

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    const anchor = trigger === 'children' ? wrapperRef.current : badgeRef.current;
    if (!open && anchor) {
      const rect = anchor.getBoundingClientRect();
      const width = reviewForThisSlide || runningForThisSlide ? 360 : 296;
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left - width + 32, window.innerWidth - width - 8)),
      });
    }
    setOpen((v) => !v);
  }

  // Auto-open this popover when a review for this slide arrives, so the user
  // sees the suggestion right under the comment box (or whichever field's
  // anchor was last interacted with). The `field` match is best-effort —
  // only the field that holds the triggering comment auto-opens.
  useEffect(() => {
    if (!reviewForThisSlide) return;
    const matchingComment = comments.find(
      (c) => !c.resolved && pending?.commentIds.includes(c.id) && c.field === field,
    );
    if (!matchingComment || open) return;
    const anchor = trigger === 'children' ? wrapperRef.current : badgeRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left - 328, window.innerWidth - 368)),
    });
    setOpen(true);
  }, [reviewForThisSlide, pending, comments, field, open, trigger]);

  // Outside click closes the popover — UNLESS the agent is running or a review
  // is pending. We never want the user to accidentally lose a suggestion.
  useEffect(() => {
    if (!open || lockedOpen) return;
    function handler(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, lockedOpen]);

  useEffect(() => {
    if (open && status === 'idle' && !reviewForThisSlide) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, status, reviewForThisSlide]);

  function process(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!cursorCliReady) return;

    const mentions: string[] = Array.from(
      new Set<string>((text.match(/@\w+/g) ?? []).map((m: string) => m.toLowerCase())),
    );

    onAddComment({ slideId, field, author: authorName, body: text, resolved: false, mentions });
    setDraft('');
    // Popover STAYS OPEN — it will switch to drafting/review state automatically.
  }

  async function accept() {
    if (!onAcceptReview || busy) return;
    setBusy('accept');
    try {
      await onAcceptReview();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!onRejectReview || busy) return;
    setBusy('reject');
    try {
      await onRejectReview();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  const fieldLabel = humanLabel(field);
  const popoverWidth = reviewForThisSlide || runningForThisSlide ? 'w-[360px]' : 'w-72';

  const popover =
    open && popoverPos
      ? createPortal(
          <div
            ref={popoverRef}
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
            className={`${popoverWidth} bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 bg-stone-50">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>{fieldLabel}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={lockedOpen}
                title={lockedOpen ? 'Save or Discard to close' : 'Close'}
                className="text-stone-400 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Existing comment thread (single item in the one-comment-at-a-time flow) */}
            {comments.length > 0 && (
              <div className="px-3 pt-2.5 pb-1 space-y-1.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-snug border ${
                      c.resolved
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : 'bg-amber-50/60 border-amber-100 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-stone-500">
                        {c.author}
                      </span>
                      {!c.resolved && status === 'idle' && (
                        <button
                          onClick={() => onResolveComment(c.id)}
                          title="Dismiss"
                          className="text-stone-400 hover:text-stone-700 text-[10px]"
                        >
                          dismiss
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Drafting state */}
            {runningForThisSlide && (
              <div className="px-3 py-3 flex items-center gap-2 text-xs text-violet-700 bg-violet-50/60 border-t border-violet-100">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                <span className="font-semibold">
                  Cursor CLI is drafting a suggestion…
                </span>
              </div>
            )}

            {/* Review state — diff + save / discard */}
            {reviewForThisSlide && pending && (
              <div className="border-t border-violet-100 bg-violet-50/30">
                <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    Suggested edits
                  </span>
                  <span className="text-[10px] font-semibold text-violet-700 bg-white border border-violet-200 rounded-full px-1.5 py-0.5">
                    {pending.diffs.length} change{pending.diffs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="px-3 pb-2 space-y-2 max-h-72 overflow-y-auto">
                  {pending.diffs.length === 0 && (
                    <p className="text-[11px] text-stone-500 italic">
                      No field-level edits were proposed.
                    </p>
                  )}
                  {pending.diffs.map((d) => (
                    <div key={d.field}>
                      <DiffRow diff={d} />
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 flex items-center justify-end gap-1.5 border-t border-violet-100 bg-white/70">
                  <button
                    type="button"
                    onClick={() => void reject()}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-50 transition"
                  >
                    {busy === 'reject' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => void accept()}
                    disabled={busy !== null || pending.diffs.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {busy === 'accept' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {errorForThisSlide && !reviewForThisSlide && !runningForThisSlide && (
              <div className="px-3 py-2.5 flex items-start gap-2 text-[11px] text-red-700 bg-red-50/70 border-t border-red-100">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <p className="font-semibold leading-snug">
                    {agentSession?.errorMessage ?? 'Agent run failed.'}
                  </p>
                  {unresolved.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onResolveComment(unresolved[0].id)}
                      className="flex items-center gap-1 text-[10px] font-bold text-red-800 hover:underline"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Dismiss and try again
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* New comment input — hidden while a review is in flight */}
            {!reviewForThisSlide && !runningForThisSlide && (
              <form onSubmit={process} className="p-2 border-t border-stone-100 space-y-2">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) process(e);
                  }}
                  placeholder={`Comment on "${fieldLabel}"…`}
                  className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-violet-400 placeholder-stone-300"
                />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-stone-500 font-medium">
                    <Bot className="w-3 h-3 text-violet-600" />
                    {cursorCliReady ? 'Cursor CLI suggests edits' : 'Run `agent login` first'}
                  </span>
                  <button
                    type="submit"
                    disabled={!draft.trim() || !cursorCliReady}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Bot className="w-3 h-3" />
                    Process
                  </button>
                </div>
              </form>
            )}
          </div>,
          document.body,
        )
      : null;

  const wrapperClick = trigger === 'children' ? openPopover : undefined;
  const wrapperCursor = trigger === 'children' ? 'cursor-pointer' : '';

  return (
    <div
      ref={wrapperRef}
      onClick={wrapperClick}
      className={`relative group/anchor w-full ${wrapperCursor}`}
    >
      {children}

      {/* Corner badge — only when trigger === 'badge' (default) */}
      {trigger === 'badge' && (
        <button
          ref={badgeRef}
          onClick={openPopover}
          title={
            reviewForThisSlide
              ? 'Suggested edits ready — review to save'
              : runningForThisSlide
                ? 'Cursor CLI is drafting…'
                : `Comments on ${fieldLabel}`
          }
          className={`
            absolute -top-2 -right-2 z-20
            flex items-center justify-center
            rounded-full text-[9px] font-black shadow-md border transition-all
            ${
              reviewForThisSlide
                ? 'bg-violet-600 text-white border-violet-700 w-5 h-5 animate-pulse'
                : runningForThisSlide
                  ? 'bg-violet-100 text-violet-700 border-violet-300 w-5 h-5'
                  : hasComments
                    ? 'bg-amber-500 text-white border-amber-600 w-5 h-5'
                    : 'bg-white/90 text-stone-400 border-stone-200 w-5 h-5 opacity-0 group-hover/anchor:opacity-100'
            }
            ${open ? 'opacity-100' : ''}
          `}
        >
          {runningForThisSlide ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : reviewForThisSlide ? (
            <Bot className="w-2.5 h-2.5" />
          ) : hasComments ? (
            <span>{unresolved.length}</span>
          ) : (
            <MessageSquare className="w-2.5 h-2.5" />
          )}
        </button>
      )}

      {popover}
    </div>
  );
}

// ---- Inline diff row (compact, popover-friendly) ----

function fieldLabel(field: string): string {
  if (field === 'tag') return 'Tag';
  if (field === 'title') return 'Title';
  if (field === 'subtitle') return 'Subtitle';
  if (field === 'footerLeft') return 'Footer (left)';
  if (field === 'footerRight') return 'Footer (right)';
  if (field === 'bullets') return 'Bullets';
  if (field === 'pollOptions') return 'Poll options';
  if (field === 'bulletTextClass') return 'Bullet style';
  if (field === 'subtitleClass') return 'Subtitle style';
  if (field === 'imageUrl') return 'Image';
  return field;
}

function DiffRow({ diff }: { diff: SlideFieldDiff }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
        {fieldLabel(diff.field)}
      </div>
      {diff.kind === 'bullets' ? (
        <ListDiff
          before={(diff.before as BulletItem[] | undefined) ?? []}
          after={(diff.after as BulletItem[] | undefined) ?? []}
          getText={(x) => x.text}
        />
      ) : diff.kind === 'pollOptions' ? (
        <ListDiff
          before={(diff.before as PollOption[] | undefined) ?? []}
          after={(diff.after as PollOption[] | undefined) ?? []}
          getText={(x) => x.text}
        />
      ) : (
        <TextDiff before={diff.before} after={diff.after} />
      )}
    </div>
  );
}

function TextDiff({ before, after }: { before: unknown; after: unknown }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] leading-snug rounded-md bg-red-50 border border-red-100 px-2 py-1 text-red-700 line-through whitespace-pre-wrap">
        {String(before ?? '—') || '—'}
      </div>
      <div className="text-[11px] leading-snug rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-800 whitespace-pre-wrap">
        {String(after ?? '—') || '—'}
      </div>
    </div>
  );
}

function ListDiff<T>({
  before,
  after,
  getText,
}: {
  before: T[];
  after: T[];
  getText: (item: T) => string;
}) {
  const max = Math.max(before.length, after.length);
  return (
    <div className="space-y-1">
      {Array.from({ length: max }, (_, i) => {
        const from = before[i] !== undefined ? getText(before[i]) : undefined;
        const to = after[i] !== undefined ? getText(after[i]) : undefined;
        const changed = from !== to;
        return (
          <div key={i} className="space-y-0.5">
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1 whitespace-pre-wrap ${
                changed
                  ? 'bg-red-50 border border-red-100 text-red-700 line-through'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {from ?? <span className="italic text-stone-400">(none)</span>}
            </div>
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1 whitespace-pre-wrap ${
                changed
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {to ?? <span className="italic text-stone-400">(removed)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function humanLabel(field: CommentField): string {
  if (field === 'title') return 'Title';
  if (field === 'subtitle') return 'Subtitle';
  if (field === 'tag') return 'Tag';
  if (field === 'slide') return 'Entire Slide';
  if (field === 'footerLeft') return 'Footer (left)';
  if (field === 'footerRight') return 'Footer (right)';
  const bMatch = field.match(/^bullet-(\d+)$/);
  if (bMatch) return `Bullet ${Number(bMatch[1]) + 1}`;
  const pMatch = field.match(/^poll-(\d+)$/);
  if (pMatch) return `Poll option ${Number(pMatch[1]) + 1}`;
  return field;
}
