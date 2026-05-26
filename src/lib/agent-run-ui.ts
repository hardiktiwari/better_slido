import type { AgentRunSnapshot } from './agent-api';
import type { AgentSession } from '../types';

export function traceFieldsFromRun(run: AgentRunSnapshot): Pick<
  AgentSession,
  | 'subagent'
  | 'primarySkill'
  | 'rationale'
  | 'routedBy'
  | 'toolsCalled'
  | 'activityLines'
  | 'reasoning'
> {
  const p = run.progress;
  const r = run.result;
  return {
    subagent: p?.subagent ?? r?.subagent,
    primarySkill: p?.primarySkill ?? r?.skill,
    rationale: p?.rationale ?? r?.rationale,
    routedBy: p?.routedBy ?? r?.routedBy,
    toolsCalled: p?.toolsCalled ?? r?.toolsCalled ?? [],
    activityLines: p?.activityLines ?? [],
    reasoning: p?.reasoning ?? r?.reasoning,
  };
}

/** Body text for the expandable status panel. */
export function buildAgentDetailText(
  fields: Pick<AgentSession, 'activityLines' | 'reasoning' | 'rationale'>,
  explanation?: string,
): string {
  const parts: string[] = [];
  if (fields.rationale) {
    parts.push(`Orchestrator: ${fields.rationale}`);
  }
  if (fields.activityLines?.length) {
    parts.push(fields.activityLines.join('\n'));
  }
  if (fields.reasoning?.trim()) {
    parts.push(fields.reasoning.trim());
  }
  if (explanation?.trim()) {
    parts.push(explanation.trim());
  }
  return parts.join('\n\n');
}
