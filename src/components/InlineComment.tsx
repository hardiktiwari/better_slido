import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Send, CheckCircle, X, Bot } from 'lucide-react';
import type { SlideComment, CommentField } from '../types';

interface CommentAnchorProps {
  slideId: string;
  field: CommentField;
  comments: SlideComment[];
  onAddComment: (comment: Omit<SlideComment, 'id' | 'createdAt'>) => void;
  onResolveComment: (id: string) => void;
  onTriggerAgent: (slideId: string, field: CommentField, commentText: string) => void;
  authorName?: string;
  /**
   * 'badge' (default): show the small corner badge that opens the popover.
   * 'children': hide the badge; clicking the wrapped children opens the popover instead.
   */
  trigger?: 'badge' | 'children';
  children: React.ReactNode;
}

/**
 * Wraps a slide field with a comment popover. The popover is portaled to <body>
 * so it's never clipped by overflow:hidden parents.
 */
export function CommentAnchor({
  slideId,
  field,
  comments,
  onAddComment,
  onResolveComment,
  onTriggerAgent,
  authorName = 'Presenter',
  trigger = 'badge',
  children,
}: CommentAnchorProps) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState('');
  const badgeRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const unresolved = comments.filter((c) => !c.resolved);
  const hasComments = unresolved.length > 0;
  const mentionsAgent = draft.toLowerCase().includes('@agent');

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    // Anchor the popover from whichever element initiated the click:
    // the badge (default) or the wrapper (when trigger === 'children').
    const anchor = trigger === 'children' ? wrapperRef.current : badgeRef.current;
    if (!open && anchor) {
      const rect = anchor.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left - 220, window.innerWidth - 296)),
      });
    }
    setOpen((v) => !v);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const mentions: string[] = Array.from(
      new Set<string>((text.match(/@\w+/g) ?? []).map((m: string) => m.toLowerCase())),
    );

    onAddComment({ slideId, field, author: authorName, body: text, resolved: false, mentions });

    if (mentionsAgent) {
      onTriggerAgent(slideId, field, text);
    }

    setDraft('');
    setOpen(false);
  }

  const fieldLabel = humanLabel(field);

  const popover =
    open && popoverPos
      ? createPortal(
          <div
            ref={popoverRef}
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
            className="w-72 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 bg-stone-50">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>{fieldLabel}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Thread */}
            <div className="max-h-48 overflow-y-auto p-2 space-y-2">
              {comments.length === 0 && (
                <p className="text-[11px] text-stone-400 italic text-center py-3">
                  No comments yet. Type below to add one.
                </p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl p-2.5 text-xs space-y-1 border ${
                    c.resolved
                      ? 'bg-stone-50 border-stone-100 opacity-60'
                      : 'bg-amber-50/50 border-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-800">{c.author}</span>
                      {c.mentions.includes('@agent') && (
                        <span className="flex items-center gap-0.5 bg-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          <Bot className="w-2.5 h-2.5" />
                          agent tagged
                        </span>
                      )}
                    </div>
                    {!c.resolved && (
                      <button
                        onClick={() => onResolveComment(c.id)}
                        title="Mark resolved"
                        className="text-stone-400 hover:text-green-600 flex-shrink-0"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-stone-700 leading-relaxed">{c.body}</p>
                  {c.resolved && (
                    <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">
                      Resolved
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* New comment input */}
            <form onSubmit={submitComment} className="p-2 border-t border-stone-100 space-y-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(e);
                }}
                placeholder={`Comment on "${fieldLabel}"… type @agent to tag`}
                className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-amber-400 placeholder-stone-300"
              />
              <div className="flex items-center justify-between">
                {mentionsAgent ? (
                  <span className="flex items-center gap-1 text-[10px] text-violet-600 font-semibold">
                    <Bot className="w-3 h-3" />
                    Agent will be notified
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-40 ${
                    mentionsAgent
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {mentionsAgent ? (
                    <>
                      <Bot className="w-3 h-3" />
                      Tag Agent
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      Comment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )
      : null;

  // When trigger === 'children', the wrapped element itself opens the popover (no badge).
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
          title={`Comments on ${fieldLabel}`}
          className={`
            absolute -top-2 -right-2 z-20
            flex items-center justify-center
            rounded-full text-[9px] font-black shadow-md border transition-all
            ${
              hasComments
                ? 'bg-amber-500 text-white border-amber-600 w-5 h-5'
                : 'bg-white/90 text-stone-400 border-stone-200 w-5 h-5 opacity-0 group-hover/anchor:opacity-100'
            }
            ${open ? 'opacity-100' : ''}
          `}
        >
          {hasComments ? (
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
