import fs from "fs";
import path from "path";
import type { CommentEditContext } from "./slide-context.js";
import type { AgentDirective } from "./managed-agent.js";

export interface AgentTraceRecord {
  timestamp: string;
  request: {
    slideId?: string;
    commentText: string;
    targetElement?: string;
    context?: unknown;
    commentIds?: string[];
  };
  insertedDirectiveLine?: number;
  editContext?: CommentEditContext;
  directive?: { file: string; line: number; text: string };
  subagent?: string;
  promptChars?: number;
  promptPreview?: string;
  toolsCalled?: string[];
  sessionId?: string;
  applied?: boolean;
  success?: boolean;
  explanation?: string;
  cliLogs?: string[];
  rawStdoutPreview?: string;
}

const TRACE_DIR = "logs";
const TRACE_FILE = "last-agent-trace.json";

export function traceFilePath(cwd: string): string {
  return path.join(cwd, TRACE_DIR, TRACE_FILE);
}

export function writeAgentTrace(cwd: string, record: AgentTraceRecord): void {
  const dir = path.join(cwd, TRACE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = traceFilePath(cwd);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
}

export function readAgentTrace(cwd: string): AgentTraceRecord | null {
  const filePath = traceFilePath(cwd);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as AgentTraceRecord;
  } catch {
    return null;
  }
}

export function buildTraceRecord(input: {
  request: AgentTraceRecord["request"];
  insertedDirectiveLine?: number;
  editContext?: CommentEditContext;
  directive?: AgentDirective;
  subagent?: string;
  prompt?: string;
  toolsCalled?: string[];
  sessionId?: string;
  applied?: boolean;
  success?: boolean;
  explanation?: string;
  cliLogs?: string[];
  rawStdout?: string;
}): AgentTraceRecord {
  const prompt = input.prompt ?? "";
  return {
    timestamp: new Date().toISOString(),
    request: input.request,
    insertedDirectiveLine: input.insertedDirectiveLine,
    editContext: input.editContext,
    directive: input.directive
      ? {
          file: input.directive.file,
          line: input.directive.line,
          text: input.directive.text,
        }
      : undefined,
    subagent: input.subagent,
    promptChars: prompt.length,
    promptPreview: prompt.slice(0, 4000),
    toolsCalled: input.toolsCalled,
    sessionId: input.sessionId,
    applied: input.applied,
    success: input.success,
    explanation: input.explanation,
    cliLogs: input.cliLogs,
    rawStdoutPreview: input.rawStdout?.slice(0, 8000),
  };
}
