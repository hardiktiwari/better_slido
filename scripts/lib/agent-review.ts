import fs from "node:fs";
import path from "node:path";
import { findWebhookDirectiveLine } from "./managed-agent.js";
import type { RunManagedAgentOptions } from "./managed-agent.js";
import { runCursorAgent } from "./cursor-agent.js";
import { processImageGenerations } from "./image-generator.js";
import {
  buildCommentEditContext,
  type CommentWebhookPayload,
} from "./slide-context.js";
import { buildTraceRecord, writeAgentTrace } from "./agent-trace.js";
import { appendAgentRunProgress, type AgentRunResult } from "./agent-run-store.js";
import type { AgentProgressUpdate } from "./managed-agent.js";

export interface ReviewCommentInput {
  id?: string;
  field?: string;
  body: string;
}

export interface AgentReviewContext {
  slideIndex?: number;
  field?: string;
  targetElement?: string;
  slide?: CommentWebhookPayload["slide"];
}

export interface AgentReviewInput {
  slideId: string;
  comments: ReviewCommentInput[];
  targetElement?: string;
  context?: AgentReviewContext;
}

export function buildCombinedAgentComment(comments: ReviewCommentInput[]): string {
  const bodies = comments.map((c) => c.body.trim()).filter(Boolean);
  if (bodies.length === 0) return "@agent Please apply pending slide feedback.";
  if (bodies.length === 1) return bodies[0];
  return bodies
    .map((body, i) => {
      const field = comments[i]?.field;
      const label = field ? `[${field}] ` : "";
      return `${i + 1}. ${label}${body}`;
    })
    .join(" | ");
}

export async function executeAgentReview(
  cwd: string,
  input: AgentReviewInput,
  runAgent: (cwd: string, options?: RunManagedAgentOptions) => Promise<Awaited<ReturnType<typeof runCursorAgent>>>,
  runId?: string,
): Promise<AgentRunResult> {
  const onProgress: ((update: AgentProgressUpdate) => void) | undefined = runId
    ? (update) => {
        appendAgentRunProgress(runId, update);
      }
    : undefined;
  const { slideId, comments, targetElement, context } = input;
  if (!comments.length) {
    return {
      success: false,
      applied: false,
      explanation: "No comments to apply.",
      cliLogs: [],
      commentsFound: 0,
    };
  }

  const rawComment = buildCombinedAgentComment(comments);
  const agentComment = /@agent/i.test(rawComment) ? rawComment : `@agent ${rawComment}`;

  const appPath = path.join(cwd, "src/App.tsx");
  if (!fs.existsSync(appPath)) {
    return {
      success: false,
      applied: false,
      explanation: "src/App.tsx not found.",
      cliLogs: [],
      commentsFound: comments.length,
    };
  }

  const fileContent = fs.readFileSync(appPath, "utf-8");
  const lines = fileContent.split("\n");

  let targetLineIndex = -1;
  let insertedDirectiveLine: number | undefined;
  if (slideId) {
    targetLineIndex = lines.findIndex(
      (line) => line.includes(`id: '${slideId}'`) || line.includes(`id: "${slideId}"`),
    );
  }
  if (targetLineIndex === -1) {
    targetLineIndex = lines.findIndex((line) => line.includes("const DEFAULT_DECK"));
  }

  if (targetLineIndex !== -1) {
    const indentMatch = lines[targetLineIndex].match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : "  ";
    const targetTag =
      targetElement && targetElement !== "general" ? `[target:${targetElement}] ` : "";
    const directive = `${indent}// @agent: resolve: ${targetTag}${agentComment.replace(/\r?\n/g, " ")}`;
    lines.splice(targetLineIndex, 0, directive);
    fs.writeFileSync(appPath, lines.join("\n"), "utf-8");
    insertedDirectiveLine =
      findWebhookDirectiveLine(appPath, agentComment, slideId) ?? targetLineIndex + 1;
    console.log(
      `[AgentReview] Inserted @agent directive into src/App.tsx at line ${insertedDirectiveLine}`,
    );
  } else {
    console.warn("[AgentReview] Could not find insertion point in src/App.tsx");
  }

  const primaryField =
    typeof context?.field === "string"
      ? context.field
      : typeof comments[0]?.field === "string"
        ? comments[0].field
        : undefined;

  const webhookPayload: CommentWebhookPayload = {
    slideId,
    slideIndex: typeof context?.slideIndex === "number" ? context.slideIndex : undefined,
    field: primaryField,
    targetElement:
      typeof targetElement === "string"
        ? targetElement
        : typeof context?.targetElement === "string"
          ? context.targetElement
          : undefined,
    slide: context?.slide && typeof context.slide === "object" ? context.slide : undefined,
  };

  const editContext = buildCommentEditContext(
    cwd,
    webhookPayload,
    agentComment,
    insertedDirectiveLine,
  );
  console.log(
    `[AgentReview] Focused context: ${editContext.slideId} ${editContext.field} → App.tsx:${editContext.sourceStartLine}-${editContext.sourceEndLine}`,
  );

  let result: Awaited<ReturnType<typeof runCursorAgent>>;
  try {
    result = await runAgent(cwd, {
      preferLine: insertedDirectiveLine,
      editContext,
      onProgress,
    });
  } catch (runError: unknown) {
    const message = runError instanceof Error ? runError.message : "Agent run failed";
    console.error("[AgentReview] Agent run error:", runError);
    result = {
      success: false,
      applied: false,
      explanation: message,
      logs: [`[AgentReview] ${message}`],
      commentsFound: comments.length,
    };
  }

  const trace = buildTraceRecord({
    request: {
      slideId,
      commentText: agentComment,
      targetElement,
      context,
      commentIds: comments.map((c) => c.id).filter(Boolean),
    },
    insertedDirectiveLine,
    editContext,
    directive: result.directive,
    subagent: result.runMeta?.subagent,
    prompt: result.runMeta?.prompt,
    toolsCalled: result.runMeta?.toolsCalled,
    sessionId: result.interactionId,
    applied: result.applied,
    success: result.success,
    explanation: result.explanation,
    cliLogs: result.logs,
    rawStdout: result.outputText,
  });
  writeAgentTrace(cwd, trace);
  console.log(
    `[AgentReview] Trace: logs/last-agent-trace.json · applied=${result.applied} · tools=${(trace.toolsCalled ?? []).join(", ") || "none"}`,
  );

  let imageLogs: string[] = [];
  let generatedImages: Array<{ filename: string; path: string; bytes: number }> = [];
  if (result.imageGenerations && result.imageGenerations.length > 0) {
    console.log(`[AgentReview] Agent requested ${result.imageGenerations.length} image(s). Running Imagen-3…`);
    const imageRun = await processImageGenerations(cwd, result.imageGenerations);
    imageLogs = imageRun.logs;
    generatedImages = imageRun.results;
    for (const line of imageLogs) console.log(line);
  }

  return {
    success: result.success,
    applied: result.applied,
    explanation: result.explanation,
    cliLogs: [...result.logs, ...imageLogs],
    commentsFound: result.commentsFound,
    interactionId: result.interactionId,
    skill: result.skill,
    subagent: result.runMeta?.subagent ?? trace.subagent,
    generatedImages,
    tracePath: "logs/last-agent-trace.json",
    toolsCalled: trace.toolsCalled ?? [],
    directiveLine: result.directive?.line,
  };
}
