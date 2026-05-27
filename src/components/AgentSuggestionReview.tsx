import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { BulletItem, PendingReview, PollOption, SlideFieldDiff } from '../types';

interface AgentSuggestionReviewProps {
  pending: PendingReview;
  onAccept: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onRefine: (followUpText: string) => Promise<void> | void;
}

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

function renderTextDiff(before: unknown, after: unknown) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
      <div className="text-[11px] leading-snug rounded-md bg-red-50 border border-red-100 px-2 py-1.5 text-red-700 line-through whitespace-pre-wrap">
        {String(before ?? '—') || '—'}
      </div>
      <div className="text-[11px] leading-snug rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-emerald-800 whitespace-pre-wrap">
        {String(after ?? '—') || '—'}
      </div>
    </div>
  );
}

function renderBulletsDiff(before: unknown, after: unknown) {
  const b = (before as BulletItem[] | undefined) ?? [];
  const a = (after as BulletItem[] | undefined) ?? [];
  const max = Math.max(a.length, b.length);
  const rows: { from?: string; to?: string }[] = [];
  for (let i = 0; i < max; i++) {
    rows.push({ from: b[i]?.text, to: a[i]?.text });
  }
  return (
    <div className="mt-1 space-y-1">
      {rows.map((row, i) => {
        const changed = row.from !== row.to;
        return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1.5 whitespace-pre-wrap ${
                changed
                  ? 'bg-red-50 border border-red-100 text-red-700 line-through'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {row.from ?? <span className="italic text-stone-400">(none)</span>}
            </div>
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1.5 whitespace-pre-wrap ${
                changed
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {row.to ?? <span className="italic text-stone-400">(removed)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderPollDiff(before: unknown, after: unknown) {
  const b = (before as PollOption[] | undefined) ?? [];
  const a = (after as PollOption[] | undefined) ?? [];
  const max = Math.max(a.length, b.length);
  const rows: { from?: string; to?: string }[] = [];
  for (let i = 0; i < max; i++) {
    rows.push({ from: b[i]?.text, to: a[i]?.text });
  }
  return (
    <div className="mt-1 space-y-1">
      {rows.map((row, i) => {
        const changed = row.from !== row.to;
        return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1.5 whitespace-pre-wrap ${
                changed
                  ? 'bg-red-50 border border-red-100 text-red-700 line-through'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {row.from ?? <span className="italic text-stone-400">(none)</span>}
            </div>
            <div
              className={`text-[11px] leading-snug rounded-md px-2 py-1.5 whitespace-pre-wrap ${
                changed
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-stone-50 border border-stone-100 text-stone-500'
              }`}
            >
              {row.to ?? <span className="italic text-stone-400">(removed)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderDiff(diff: SlideFieldDiff) {
  if (diff.kind === 'bullets') return renderBulletsDiff(diff.before, diff.after);
  if (diff.kind === 'pollOptions') return renderPollDiff(diff.before, diff.after);
  return renderTextDiff(diff.before, diff.after);
}

export function AgentSuggestionReview({
  pending,
  onAccept,
  onReject,
  onRefine,
}: AgentSuggestionReviewProps) {
  const [busy, setBusy] = useState<'accept' | 'reject' | 'refine' | null>(null);
  const [refining, setRefining] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const refineRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (refining) setTimeout(() => refineRef.current?.focus(), 30);
  }, [refining]);

  async function handle(action: 'accept' | 'reject') {
    if (busy) return;
    setBusy(action);
    try {
      await (action === 'accept' ? onAccept() : onReject());
    } finally {
      setBusy(null);
    }
  }

  async function submitRefine(e: FormEvent) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text || busy) return;
    setBusy('refine');
    try {
      await onRefine(text);
      setFollowUp('');
      setRefining(false);
    } finally {
      setBusy(null);
    }
  }

  const hasDiffs = pending.diffs.length > 0;

  return (
    <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 space-y-3 max-h-80 overflow-y-auto">
        {!hasDiffs ? (
          <p className="text-xs text-stone-500">No edits were proposed. Reject to dismiss.</p>
        ) : (
          pending.diffs.map((diff) => (
            <div key={diff.field}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                {fieldLabel(diff.field)}
              </div>
              {renderDiff(diff)}
            </div>
          ))
        )}
      </div>

      {refining && (
        <form
          onSubmit={submitRefine}
          className="px-4 py-2.5 border-t border-violet-100 bg-violet-50/40 space-y-2"
        >
          <textarea
            ref={refineRef}
            rows={2}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitRefine(e);
              if (e.key === 'Escape') {
                setRefining(false);
                setFollowUp('');
              }
            }}
            placeholder="Refine your prompt (e.g. “shorter”, “keep the data point”)…"
            className="w-full text-xs border border-violet-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-violet-400 placeholder-stone-400"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRefining(false);
                setFollowUp('');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-white/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!followUp.trim() || busy !== null}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy === 'refine' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Re-run
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-violet-100 bg-stone-50/70">
        <button
          type="button"
          onClick={() => setRefining((v) => !v)}
          disabled={busy !== null}
          className="text-[11px] font-semibold text-violet-700 hover:underline disabled:opacity-50"
          title="Refine the prompt and re-run"
        >
          {refining ? 'Hide refine' : 'Refine prompt'}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handle('reject')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-200 text-stone-700 hover:bg-stone-100 disabled:opacity-50 transition"
          >
            {busy === 'reject' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Reject
          </button>
          <button
            type="button"
            onClick={() => void handle('accept')}
            disabled={busy !== null || !hasDiffs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy === 'accept' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
