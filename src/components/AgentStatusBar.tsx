import { Bot, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AgentSession } from '../types';

interface AgentStatusBarProps {
  session: AgentSession;
  onCancel: () => void;
}

/**
 * Thin one-line indicator under the slide.
 * Intentionally minimal — the full review UI is the AgentSuggestionReview panel.
 */
export function AgentStatusBar({ session, onCancel }: AgentStatusBarProps) {
  const { status } = session;

  // Idle and review states are handled elsewhere (or not at all).
  if (status === 'idle' || status === 'review') return null;

  const cfg = (() => {
    switch (status) {
      case 'queued':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />,
          label: 'Waiting in agent queue…',
          bar: 'bg-amber-50 border-amber-200',
          color: 'text-amber-800',
        };
      case 'thinking':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />,
          label: 'Cursor CLI is drafting a suggestion…',
          bar: 'bg-violet-50 border-violet-200',
          color: 'text-violet-700',
        };
      case 'streaming':
        return {
          icon: <Bot className="w-3.5 h-3.5 text-violet-600" />,
          label: 'Cursor CLI is drafting a suggestion…',
          bar: 'bg-violet-50 border-violet-200',
          color: 'text-violet-700',
        };
      case 'applied':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Suggestion saved to the slide.',
          bar: 'bg-emerald-50 border-emerald-200',
          color: 'text-emerald-700',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
          label: session.errorMessage ?? 'Agent run failed.',
          bar: 'bg-red-50 border-red-200',
          color: 'text-red-700',
        };
      default:
        return { icon: null, label: '', bar: '', color: '' };
    }
  })();

  return (
    <div
      className={`rounded-2xl border px-4 py-2.5 flex items-center justify-between gap-3 ${cfg.bar}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {cfg.icon}
        <span className={`text-xs font-semibold truncate ${cfg.color}`}>{cfg.label}</span>
      </div>
      <button
        onClick={onCancel}
        title="Dismiss"
        className="shrink-0 text-stone-400 hover:text-stone-600 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
