import fs from "node:fs";
import path from "node:path";
import type { RunManagedAgentOptions } from "./managed-agent.js";
import { runCursorAgent } from "./cursor-agent.js";
import { executeAgentReview, type AgentReviewInput } from "./agent-review.js";
import {
  readSlideFieldsFromApp,
  readSlideFieldsFromSource,
} from "./deck-source.js";
import {
  cancelQueuedRunsForSlide,
  createAgentRun,
  getActiveRunForSlide,
  getAgentRun,
  hasRunFileSnapshot,
  patchAgentRun,
  storeRunFileSnapshot,
  takeRunFileSnapshot,
  type AgentRunRecord,
} from "./agent-run-store.js";

const AGENT_RUN_TIMEOUT_MS = Number(process.env.CURSOR_AGENT_RUN_TIMEOUT_MS) || 660_000;

let agentRunChain: Promise<unknown> = Promise.resolve();

/**
 * Build a user-facing error string when the agent runs but doesn't actually
 * edit src/App.tsx. We deliberately suppress the raw Cursor CLI stdout (which
 * is NDJSON like `{"type":"system","subtype":"init",...}`) — that's noise to
 * the presenter, not signal.
 */
function friendlyAgentError(result: {
  explanation?: string;
  toolsCalled?: string[];
  cliLogs?: string[];
}): string {
  const tools = (result.toolsCalled ?? []).filter(Boolean);
  const exp = (result.explanation ?? "").trim();
  const looksLikeRawNdjson =
    !exp ||
    exp.startsWith("{") ||
    /"type"\s*:\s*"(system|user|assistant|thinking|tool_call|tool_use)"/.test(exp);

  if (looksLikeRawNdjson) {
    if (tools.length && !tools.some((t) => /edit|write|replace/i.test(t))) {
      return "The agent looked at the slide but didn't propose any edits. Try a more specific prompt (e.g. \"shorten the title\" or \"swap subtitle to X\") and re-run.";
    }
    return "The agent finished without making any changes. Try refining your prompt and re-run.";
  }
  // Truncate any free-form explanation for the status bar.
  return exp.length > 220 ? exp.slice(0, 217) + "…" : exp;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Run Cursor agent with timeout — for use *inside* an already-queued job (do not re-enter the queue). */
function runCursorAgentDirect(cwd: string, options?: RunManagedAgentOptions) {
  return withTimeout(runCursorAgent(cwd, options), AGENT_RUN_TIMEOUT_MS, "Cursor agent run");
}

export function runAgentQueued(cwd: string, options?: RunManagedAgentOptions) {
  const run = agentRunChain.then(() => runCursorAgentDirect(cwd, options));
  agentRunChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function startBackgroundAgentReview(
  cwd: string,
  input: AgentReviewInput,
  commentIds?: string[],
): AgentRunRecord {
  if (input.slideId) {
    const active = getActiveRunForSlide(input.slideId);
    if (active?.phase === "queued") {
      console.log(`[AgentReview] Reusing queued run ${active.id} · slide=${input.slideId}`);
      return active;
    }
  }

  if (input.slideId) {
    cancelQueuedRunsForSlide(
      input.slideId,
      "Superseded by a newer review on this slide.",
    );
  }

  const record = createAgentRun({ slideId: input.slideId, commentIds });
  const runId = record.id;

  // Snapshot the file before the run so reject can roll the slide back.
  const appPath = path.join(cwd, "src/App.tsx");
  let preFields: ReturnType<typeof readSlideFieldsFromSource> | undefined;
  if (fs.existsSync(appPath)) {
    const snapshot = fs.readFileSync(appPath, "utf-8");
    storeRunFileSnapshot(runId, snapshot);
    if (input.slideId) {
      preFields = readSlideFieldsFromSource(snapshot, input.slideId);
    }
  }

  const work = agentRunChain
    .then(async () => {
      patchAgentRun(runId, { phase: "running" });
      console.log(`[AgentReview] Running ${runId} · slide=${input.slideId}`);
      // Must not call runAgentQueued here — that waits on agentRunChain and deadlocks.
      return executeAgentReview(cwd, input, runCursorAgentDirect, runId);
    })
    .then((result) => {
      const progress = getAgentRun(runId)?.progress;
      const postFields =
        result.applied && input.slideId ? readSlideFieldsFromApp(cwd, input.slideId) : undefined;

      patchAgentRun(runId, {
        phase: result.applied ? "awaiting_review" : "error",
        result: {
          ...result,
          subagent: result.subagent ?? progress?.subagent,
          rationale: progress?.rationale,
          routedBy: progress?.routedBy,
          reasoning: progress?.reasoning,
          toolsCalled: progress?.toolsCalled ?? result.toolsCalled,
          preFields,
          postFields,
        },
        error: result.applied ? undefined : friendlyAgentError(result),
        progress: progress ? { ...progress, stage: "done" } : undefined,
      });
      return result;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Agent review failed";
      patchAgentRun(runId, { phase: "error", error: message });
      // Don't keep the snapshot around on error — there's nothing to roll back to.
      takeRunFileSnapshot(runId);
    });

  agentRunChain = work.then(
    () => undefined,
    () => undefined,
  );

  return record;
}

/** User accepted the suggestion — file is already updated; drop the snapshot. */
export function acceptAgentRun(runId: string): { ok: boolean; reason?: string } {
  const run = getAgentRun(runId);
  if (!run) return { ok: false, reason: "Unknown run id." };
  if (run.phase !== "awaiting_review") {
    return { ok: false, reason: `Run is in phase ${run.phase}, not awaiting_review.` };
  }
  takeRunFileSnapshot(runId);
  patchAgentRun(runId, { phase: "completed" });
  return { ok: true };
}

/** User rejected the suggestion — restore the pre-run file contents. */
export function rejectAgentRun(
  cwd: string,
  runId: string,
): { ok: boolean; reason?: string } {
  const run = getAgentRun(runId);
  if (!run) return { ok: false, reason: "Unknown run id." };
  if (run.phase !== "awaiting_review") {
    return { ok: false, reason: `Run is in phase ${run.phase}, not awaiting_review.` };
  }
  if (!hasRunFileSnapshot(runId)) {
    return { ok: false, reason: "No snapshot available — cannot roll back." };
  }
  const snapshot = takeRunFileSnapshot(runId);
  if (snapshot === undefined) return { ok: false, reason: "Snapshot missing." };

  const appPath = path.join(cwd, "src/App.tsx");
  fs.writeFileSync(appPath, snapshot, "utf-8");
  patchAgentRun(runId, { phase: "rejected" });
  return { ok: true };
}
