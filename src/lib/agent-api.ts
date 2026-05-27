import type { BulletItem, CommentField, CommentWebhookContext, PollOption } from '../types';

export type AgentRunPhase =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'completed'
  | 'rejected'
  | 'error';

export interface SlideFieldsSnapshot {
  tag?: string;
  title?: string;
  subtitle?: string;
  bulletTextClass?: string;
  subtitleClass?: string;
  imageUrl?: string;
  footerLeft?: string;
  footerRight?: string;
  bullets?: BulletItem[];
  pollOptions?: PollOption[];
  commentary?: string;
}

export interface AgentRunProgressSnapshot {
  stage?: string;
  subagent?: string;
  primarySkill?: string;
  rationale?: string;
  routedBy?: string;
  toolsCalled?: string[];
  reasoning?: string;
  activityLines?: string[];
}

export interface AgentRunSnapshot {
  id: string;
  phase: AgentRunPhase;
  error?: string;
  progress?: AgentRunProgressSnapshot;
  result?: {
    success?: boolean;
    applied?: boolean;
    explanation?: string;
    cliLogs?: string[];
    subagent?: string;
    skill?: string;
    rationale?: string;
    routedBy?: string;
    toolsCalled?: string[];
    reasoning?: string;
    preFields?: SlideFieldsSnapshot;
    postFields?: SlideFieldsSnapshot;
  };
}

export interface ReviewCommentPayload {
  id: string;
  field: CommentField;
  body: string;
}

export class AgentApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? (await res.text()) ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export interface EnvCheckSnapshot {
  hasKey: boolean;
  provider: string;
  authMode?: string;
  email?: string;
  orchestratorMode?: string;
}

export async function fetchEnvCheck(): Promise<EnvCheckSnapshot> {
  const res = await fetch('/api/env-check');
  if (!res.ok) {
    throw new AgentApiError(res.status, 'Could not reach agent API. Run npm run dev on port 3000.');
  }
  return (await res.json()) as EnvCheckSnapshot;
}

export async function fetchSlideSourceFields(slideId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`/api/slides/${encodeURIComponent(slideId)}/source-fields`);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

export async function startAgentReview(body: {
  slideId: string;
  comments: ReviewCommentPayload[];
  targetElement: string;
  context: CommentWebhookContext;
}): Promise<{ runId: string }> {
  const res = await fetch('/api/agent/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 404) {
    throw new AgentApiError(
      404,
      'API not found. Run npm run dev and open http://localhost:3000 (not vite-only on :5173 without proxy).',
    );
  }

  const data = (await res.json()) as { runId?: string; error?: string };

  if (!res.ok && res.status !== 202) {
    throw new AgentApiError(res.status, data.error ?? res.statusText);
  }

  if (data.error || !data.runId) {
    throw new AgentApiError(500, data.error ?? 'Server did not return a run id.');
  }

  return { runId: data.runId };
}

export async function acceptAgentRun(runId: string): Promise<void> {
  const res = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new AgentApiError(res.status, await readErrorBody(res));
}

export async function rejectAgentRun(runId: string): Promise<void> {
  const res = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/reject`, {
    method: 'POST',
  });
  if (!res.ok) throw new AgentApiError(res.status, await readErrorBody(res));
}

export async function fetchAgentRun(
  runId: string,
  signal?: AbortSignal,
): Promise<AgentRunSnapshot> {
  const res = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}`, { signal });

  if (res.status === 404) {
    throw new AgentApiError(
      404,
      'Lost track of this agent run (server restarted?). Click Done reviewing again.',
    );
  }

  if (!res.ok) {
    throw new AgentApiError(res.status, await readErrorBody(res));
  }

  return (await res.json()) as AgentRunSnapshot;
}
