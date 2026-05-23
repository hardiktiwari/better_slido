import { useEffect, useRef } from 'react';
import { Bot, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AgentSession } from '../types';

interface AgentStatusBarProps {
  session: AgentSession;
  onCancel: () => void;
}

/**
 * Displays below the slide canvas when the agent is active.
 * Shows a three-stage lifecycle:
 *   thinking → streaming (typewriter) → review ready
 */
export function AgentStatusBar({ session, onCancel }: AgentStatusBarProps) {
  const { status, streamingText, proposedOps } = session;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as tokens stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText]);

  if (status === 'idle') return null;

  const statusConfig = {
    thinking: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />,
      label: 'Agent is reading the slide…',
      barColor: 'bg-violet-50 border-violet-200',
      labelColor: 'text-violet-700',
    },
    streaming: {
      icon: <Bot className="w-3.5 h-3.5 text-violet-600" />,
      label: 'Agent is thinking…',
      barColor: 'bg-violet-50 border-violet-200',
      labelColor: 'text-violet-700',
    },
    applied: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      label: `Applied ${proposedOps.length} change${proposedOps.length !== 1 ? 's' : ''} to the slide`,
      barColor: 'bg-emerald-50 border-emerald-200',
      labelColor: 'text-emerald-700',
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
      label: session.errorMessage ?? 'Something went wrong',
      barColor: 'bg-red-50 border-red-200',
      labelColor: 'text-red-700',
    },
    idle: {
      icon: null,
      label: '',
      barColor: '',
      labelColor: '',
    },
  }[status];

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-col gap-2 transition-all duration-300 ${statusConfig.barColor}`}
    >
      {/* Top row: icon + label + dismiss */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {statusConfig.icon}
          <span className={`text-xs font-semibold ${statusConfig.labelColor}`}>
            {statusConfig.label}
          </span>
        </div>
        <button
          onClick={onCancel}
          title="Dismiss agent"
          className="text-stone-400 hover:text-stone-600 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Streaming text preview — only while actively streaming */}
      {status === 'streaming' && streamingText && (
        <div
          ref={scrollRef}
          className="max-h-20 overflow-y-auto text-[11px] text-stone-600 leading-relaxed font-mono bg-white/70 rounded-lg px-3 py-2 border border-stone-100"
        >
          {streamingText}
          {status === 'streaming' && (
            <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle rounded-sm" />
          )}
        </div>
      )}
    </div>
  );
}
