import type { RunManagedAgentOptions } from "./managed-agent.js";
import { runCursorAgent } from "./cursor-agent.js";
import { executeAgentReview, type AgentReviewInput } from "./agent-review.js";
import { cancelQueuedRunsForSlide } from "./agent-run-store.js";
import {
  createAgentRun,
  getActiveRunForSlide,
  getAgentRun,
  patchAgentRun,
  type AgentRunRecord,
} from "./agent-run-store.js";

const AGENT_RUN_TIMEOUT_MS = Number(process.env.CURSOR_AGENT_RUN_TIMEOUT_MS) || 660_000;

let agentRunChain: Promise<unknown> = Promise.resolve();

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

  const work = agentRunChain
    .then(async () => {
      patchAgentRun(runId, { phase: "running" });
      console.log(`[AgentReview] Running ${runId} · slide=${input.slideId}`);
      // Must not call runAgentQueued here — that waits on agentRunChain and deadlocks.
      return executeAgentReview(cwd, input, runCursorAgentDirect, runId);
    })
    .then((result) => {
      const progress = getAgentRun(runId)?.progress;
      patchAgentRun(runId, {
        phase: result.applied ? "completed" : "error",
        result: {
          ...result,
          subagent: result.subagent ?? progress?.subagent,
          rationale: progress?.rationale,
          routedBy: progress?.routedBy,
          reasoning: progress?.reasoning,
          toolsCalled: progress?.toolsCalled ?? result.toolsCalled,
        },
        error: result.applied ? undefined : result.explanation ?? "Agent did not apply changes.",
        progress: progress ? { ...progress, stage: "done" } : undefined,
      });
      return result;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Agent review failed";
      patchAgentRun(runId, { phase: "error", error: message });
    });

  agentRunChain = work.then(
    () => undefined,
    () => undefined,
  );

  return record;
}
