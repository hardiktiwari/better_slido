import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type AgentRunPhase = "queued" | "running" | "completed" | "error";

export interface AgentRunResult {
  success: boolean;
  applied: boolean;
  explanation?: string;
  cliLogs?: string[];
  commentsFound?: number;
  interactionId?: string;
  skill?: string;
  subagent?: string;
  rationale?: string;
  routedBy?: string;
  generatedImages?: Array<{ filename: string; path: string; bytes: number }>;
  tracePath?: string;
  toolsCalled?: string[];
  directiveLine?: number;
  reasoning?: string;
}

/** Live + final trace shown in the presenter status bar. */
export interface AgentRunProgress {
  stage?: "routing" | "subagent" | "running" | "done";
  subagent?: string;
  primarySkill?: string;
  rationale?: string;
  routedBy?: string;
  toolsCalled?: string[];
  reasoning?: string;
  activityLines?: string[];
}

export interface AgentRunRecord {
  id: string;
  phase: AgentRunPhase;
  createdAt: number;
  updatedAt: number;
  slideId?: string;
  commentIds?: string[];
  error?: string;
  result?: AgentRunResult;
  progress?: AgentRunProgress;
}

const MAX_RUNS = 48;
const runs = new Map<string, AgentRunRecord>();
let runsDir = path.join(process.cwd(), "logs", "agent-runs");

function runFilePath(id: string): string {
  return path.join(runsDir, `${id}.json`);
}

function persist(record: AgentRunRecord): void {
  try {
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(runFilePath(record.id), JSON.stringify(record, null, 2), "utf-8");
  } catch (err) {
    console.warn("[AgentRunStore] Failed to persist run:", err);
  }
}

function loadFromDisk(id: string): AgentRunRecord | undefined {
  const file = runFilePath(id);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as AgentRunRecord;
  } catch {
    return undefined;
  }
}

/** Hydrate in-memory cache from disk (survives tsx server restarts). */
export function initAgentRunStore(cwd: string): void {
  runsDir = path.join(cwd, "logs", "agent-runs");
  fs.mkdirSync(runsDir, { recursive: true });
  runs.clear();

  for (const name of fs.readdirSync(runsDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(
        fs.readFileSync(path.join(runsDir, name), "utf-8"),
      ) as AgentRunRecord;
      if (record.id) runs.set(record.id, record);
    } catch {
      /* skip corrupt files */
    }
  }

  reconcileInterruptedRuns();
  pruneRuns();
}

/** Mark orphaned runs after server restart (in-memory queue is empty). */
function reconcileInterruptedRuns(): void {
  for (const record of runs.values()) {
    if (record.phase === "queued" || record.phase === "running") {
      patchAgentRun(record.id, {
        phase: "error",
        error:
          "Agent run interrupted (server restarted). Click Done reviewing to try again.",
      });
    }
  }
}

/** Drop duplicate queued jobs for the same slide when the user submits again. */
export function cancelQueuedRunsForSlide(slideId: string, reason: string): void {
  for (const record of runs.values()) {
    if (record.slideId === slideId && record.phase === "queued") {
      patchAgentRun(record.id, { phase: "error", error: reason });
    }
  }
}

/** Return an active run so repeat submissions can reuse it. */
export function getActiveRunForSlide(slideId: string): AgentRunRecord | undefined {
  const active = [...runs.values()]
    .filter((record) => record.slideId === slideId && (record.phase === "queued" || record.phase === "running"))
    .sort((a, b) => b.createdAt - a.createdAt);
  return active[0];
}

export function createAgentRun(input: {
  slideId?: string;
  commentIds?: string[];
}): AgentRunRecord {
  const id = crypto.randomUUID();
  const record: AgentRunRecord = {
    id,
    phase: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    slideId: input.slideId,
    commentIds: input.commentIds,
  };
  runs.set(id, record);
  persist(record);
  pruneRuns();
  return record;
}

export function getAgentRun(id: string): AgentRunRecord | undefined {
  const normalized = id.trim();
  const cached = runs.get(normalized);
  if (cached) return cached;

  const fromDisk = loadFromDisk(normalized);
  if (fromDisk) {
    runs.set(fromDisk.id, fromDisk);
    return fromDisk;
  }
  return undefined;
}

export function patchAgentRun(
  id: string,
  patch: Partial<Pick<AgentRunRecord, "phase" | "error" | "result" | "progress">>,
): AgentRunRecord | undefined {
  const existing = getAgentRun(id);
  if (!existing) return undefined;
  const next: AgentRunRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  runs.set(id, next);
  persist(next);
  return next;
}

export function appendAgentRunProgress(
  id: string,
  update: Partial<AgentRunProgress> & { reasoningDelta?: string },
): AgentRunRecord | undefined {
  const existing = getAgentRun(id);
  if (!existing) return undefined;

  const prev = existing.progress ?? {};
  const mergedTools = new Set([...(prev.toolsCalled ?? []), ...(update.toolsCalled ?? [])]);
  const mergedLines = [...(prev.activityLines ?? [])];
  for (const line of update.activityLines ?? []) {
    if (!mergedLines.includes(line)) mergedLines.push(line);
  }

  const progress: AgentRunProgress = {
    ...prev,
    ...update,
    toolsCalled: mergedTools.size > 0 ? [...mergedTools] : prev.toolsCalled,
    activityLines: mergedLines.length > 0 ? mergedLines : prev.activityLines,
    reasoning:
      update.reasoningDelta != null
        ? `${prev.reasoning ?? ""}${update.reasoningDelta}`.slice(-12_000)
        : update.reasoning ?? prev.reasoning,
  };
  delete (progress as { reasoningDelta?: string }).reasoningDelta;

  return patchAgentRun(id, { progress });
}

function pruneRuns(): void {
  if (runs.size <= MAX_RUNS) return;
  const sorted = [...runs.values()].sort((a, b) => a.createdAt - b.createdAt);
  const remove = sorted.slice(0, runs.size - MAX_RUNS);
  for (const r of remove) {
    runs.delete(r.id);
    try {
      fs.unlinkSync(runFilePath(r.id));
    } catch {
      /* ignore */
    }
  }
}
