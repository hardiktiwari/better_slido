import { useEffect, useRef } from 'react';
import { Bot, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AgentSession } from '../types';

interface AgentStatusBarProps {
  session: AgentSession;
  onCancel: () => void;
}

function formatSubagentLabel(subagent?: string, skill?: string): string | null {
  if (subagent) return subagent;
  if (skill) return skill;
  return null;
}

/**
 * Displays below the slide canvas when the agent is active.
 * Shows orchestrator routing, subagent, tools, and streamed reasoning.
 */
export function AgentStatusBar({ session, onCancel }: AgentStatusBarProps) {
  const {
    status,
    streamingText,
    proposedOps,
    appliedChangeCount,
    subagent,
    primarySkill,
    rationale,
    routedBy,
    toolsCalled,
    activityLines,
    reasoning,
  } = session;
  const scrollRef = useRef<HTMLDivElement>(null);

  const detailText =
    streamingText ||
    [rationale, activityLines?.join('\n'), reasoning].filter(Boolean).join('\n\n');

  const showDetailPanel =
    Boolean(detailText) &&
    (status === 'queued' ||
      status === 'thinking' ||
      status === 'streaming' ||
      status === 'applied' ||
      status === 'error');

  const subagentLabel = formatSubagentLabel(subagent, primarySkill);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [detailText, reasoning, status]);

  if (status === 'idle') return null;

  const statusConfig = {
    queued: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />,
      label: 'Agent queued — another slide edit is in progress…',
      barColor: 'bg-amber-50 border-amber-200',
      labelColor: 'text-amber-800',
    },
    thinking: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />,
      label: subagentLabel
        ? `Routing → ${subagentLabel} subagent…`
        : 'Agent is applying your comments…',
      barColor: 'bg-violet-50 border-violet-200',
      labelColor: 'text-violet-700',
    },
    streaming: {
      icon: <Bot className="w-3.5 h-3.5 text-violet-600" />,
      label: subagentLabel ? `${subagentLabel} subagent working…` : 'Agent is thinking…',
      barColor: 'bg-violet-50 border-violet-200',
      labelColor: 'text-violet-700',
    },
    applied: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      label: (() => {
        const n = appliedChangeCount ?? proposedOps.length;
        const via = subagentLabel ? ` via ${subagentLabel}` : '';
        return n > 0
          ? `Applied ${n} comment${n !== 1 ? 's' : ''}${via}`
          : `Agent updated the slide${via}`;
      })(),
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {statusConfig.icon}
          <span className={`text-xs font-semibold truncate ${statusConfig.labelColor}`}>
            {statusConfig.label}
          </span>
        </div>
        <button
          onClick={onCancel}
          title="Dismiss agent"
          className="shrink-0 text-stone-400 hover:text-stone-600 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {(subagentLabel || routedBy || (toolsCalled && toolsCalled.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {subagentLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-200/80 text-violet-900">
              Subagent: {subagentLabel}
            </span>
          )}
          {routedBy && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700">
              Router: {routedBy}
            </span>
          )}
          {toolsCalled?.map((tool) => (
            <span
              key={tool}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/80 text-stone-600 border border-stone-200/80"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {showDetailPanel && (
        <div
          ref={scrollRef}
          className="max-h-36 overflow-y-auto text-[11px] text-stone-600 leading-relaxed font-mono bg-white/70 rounded-lg px-3 py-2 border border-stone-100 whitespace-pre-wrap"
        >
          {detailText}
          {status === 'streaming' && (
            <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle rounded-sm" />
          )}
        </div>
      )}
    </div>
  );
}
