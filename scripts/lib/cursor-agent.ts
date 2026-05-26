import fs from "fs";
import path from "path";
import {
  findAgentDirectives,
  findWebhookDirectiveLine,
  type AgentDirective,
  type HarnessSkill,
  type ManagedAgentResult,
  type RunManagedAgentOptions,
} from "./managed-agent.js";
import { runCursorAgentCli, probeCursorAuth } from "./cursor-cli.js";
import {
  buildOrchestratorLogs,
  buildSubagentPrompt,
  planSubagentAsync,
  type SubagentId,
} from "./orchestrator.js";

export const CURSOR_HARNESS_VERSION = "2.1.0";

export interface CursorAgentRunMeta {
  prompt: string;
  toolsCalled: string[];
  directive: AgentDirective;
  subagent: SubagentId;
}

function directiveIsResolved(filePath: string, line: number): boolean {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const row = lines[line - 1] ?? "";
  return /^\s*\/\/ @agent: resolved:/.test(row) || /^\s*\{\/\* @agent: resolved:/.test(row);
}

function selectDirective(
  directives: AgentDirective[],
  options: RunManagedAgentOptions,
  logs: string[],
  appPath: string,
): { directive: AgentDirective | null; error?: string } {
  if (!options.preferLine && !options.editContext) {
    return { directive: directives[0] };
  }

  let targetLine = options.preferLine;

  if (targetLine) {
    const exact = directives.find((d) => d.line === targetLine);
    if (!exact) {
      const resolved = findWebhookDirectiveLine(
        appPath,
        options.editContext?.instruction ?? "",
        options.editContext?.slideId,
      );
      if (resolved) {
        logs.push(
          `[WARN] Directive not at line ${targetLine} (drift); using line ${resolved} from re-scan`,
        );
        targetLine = resolved;
      }
    }
  } else if (options.editContext) {
    targetLine = findWebhookDirectiveLine(
      appPath,
      options.editContext.instruction,
      options.editContext.slideId,
    );
  }

  const preferred = targetLine
    ? directives.find((d) => d.line === targetLine)
    : directives.length === 1
      ? directives[0]
      : undefined;

  if (!preferred) {
    logs.push(
      `[ERROR] Could not match webhook directive (${directives.length} pending: ${directives.map((d) => d.line).join(", ")})`,
    );
    return {
      directive: null,
      error: `Directive not found${options.preferLine ? ` at line ${options.preferLine}` : ""}. Pending lines: ${directives.map((d) => d.line).join(", ")}`,
    };
  }

  logs.push(`[TARGET] Processing webhook directive at line ${preferred.line}`);
  return { directive: preferred };
}

export async function runCursorAgent(
  cwd: string,
  options: RunManagedAgentOptions = {},
): Promise<ManagedAgentResult & { runMeta?: CursorAgentRunMeta }> {
  const logs: string[] = [
    `Better Slido - Cursor CLI Harness [v${CURSOR_HARNESS_VERSION}]`,
    `Backend: Cursor Agent CLI (orchestrator + subagents)`,
  ];

  const auth = await probeCursorAuth();
  logs.push(...auth.logs);
  if (!auth.available) {
    return {
      success: false,
      applied: false,
      explanation: "Cursor CLI not authenticated. Run `agent login` on this machine.",
      logs,
      commentsFound: 0,
    };
  }
  logs.push(`[Auth] Using ${auth.mode}${auth.email ? ` (${auth.email})` : ""}`);

  const appPath = path.join(cwd, "src/App.tsx");
  let directives: AgentDirective[] = [];
  if (fs.existsSync(appPath)) {
    directives = findAgentDirectives(appPath);
  }

  if (directives.length === 0) {
    logs.push(`No active '@agent: resolve:' tags found in the workspace.`);
    return {
      success: true,
      applied: false,
      logs,
      commentsFound: 0,
    };
  }

  const picked = selectDirective(directives, options, logs, appPath);
  if (!picked.directive) {
    return {
      success: false,
      applied: false,
      explanation: picked.error,
      logs,
      commentsFound: directives.length,
    };
  }
  const directive = picked.directive;

  if (options.editContext) {
    options.editContext.directiveLine = directive.line;
    options.editContext.instruction = directive.text;
  }

  const editContext = options.editContext;
  logs.push("[Orchestrator] Routing directive with Cursor CLI…");
  options.onProgress?.({ stage: "routing" });

  const plan = await planSubagentAsync(directive.text, editContext, cwd);
  if (plan.logs?.length) logs.push(...plan.logs);
  const orchestratorLines = buildOrchestratorLogs(plan, directive, editContext, {
    routedBy: plan.routedBy,
    model: plan.model,
  });
  logs.push(...orchestratorLines);

  options.onProgress?.({
    stage: "subagent",
    subagent: plan.subagent,
    primarySkill: plan.primarySkill,
    rationale: plan.rationale,
    routedBy: plan.routedBy,
    activityLines: orchestratorLines,
  });

  const fileContent = fs.readFileSync(path.join(cwd, directive.file), "utf-8");
  const lines = fileContent.split("\n");
  const startLine = Math.max(0, directive.line - 15);
  const endLine = Math.min(lines.length, directive.line + 15);
  const codeSnippet = editContext?.sourceExcerpt ?? lines.slice(startLine, endLine).join("\n");

  const prompt = buildSubagentPrompt(cwd, directive, codeSnippet, plan, editContext);
  const subagentLabel = plan.subagent as SubagentId;

  logs.push(`[Subagent:${subagentLabel}] Prompt ${prompt.length} chars — invoking Cursor CLI…`);

  options.onProgress?.({ stage: "running", subagent: subagentLabel });

  const cliResult = await runCursorAgentCli({
    prompt,
    cwd,
    authMode: auth.mode,
    onStreamUpdate: (update) => {
      options.onProgress?.({
        stage: "running",
        subagent: subagentLabel,
        reasoningDelta: update.reasoningDelta,
        toolsCalled: update.toolsCalled,
      });
    },
  });

  logs.push(...cliResult.logs);

  if (!cliResult.success) {
    return {
      success: false,
      applied: false,
      explanation: cliResult.error ?? (cliResult.resultText.slice(0, 500) || "Cursor CLI failed"),
      outputText: cliResult.rawStdout,
      interactionId: cliResult.sessionId,
      logs,
      commentsFound: directives.length,
      directive,
      skill: plan.primarySkill,
      runMeta: {
        prompt,
        toolsCalled: cliResult.toolsCalled,
        directive,
        subagent: subagentLabel,
      },
    };
  }

  const targetPath = path.join(cwd, directive.file);
  const applied = directiveIsResolved(targetPath, directive.line);

  options.onProgress?.({
    stage: "done",
    subagent: subagentLabel,
    toolsCalled: cliResult.toolsCalled,
    activityLines: applied
      ? [`[SUCCESS] Directive at line ${directive.line} resolved`]
      : [`[WARN] Directive at line ${directive.line} still unresolved`],
  });

  if (applied) {
    logs.push(`[SUCCESS] Directive at line ${directive.line} marked resolved in ${directive.file}`);
  } else {
    logs.push(`[WARN] Cursor CLI finished but line ${directive.line} is still 'resolve:'`);
    logs.push(`[WARN] Agent message: ${cliResult.resultText.slice(0, 300)}`);
  }

  return {
    success: true,
    applied,
    explanation:
      cliResult.resultText.slice(0, 1000) ||
      (applied
        ? `Resolved via ${subagentLabel} subagent`
        : `Cursor subagent ${subagentLabel} completed without resolving the directive`),
    outputText: cliResult.rawStdout,
    interactionId: cliResult.sessionId,
    logs,
    commentsFound: directives.length,
    directive,
    skill: plan.primarySkill,
    runMeta: {
      prompt,
      toolsCalled: cliResult.toolsCalled,
      directive,
      subagent: subagentLabel,
    },
  };
}

export type { RunManagedAgentOptions, ManagedAgentResult, HarnessSkill, SubagentId };
