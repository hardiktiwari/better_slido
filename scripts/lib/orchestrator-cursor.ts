import type { CommentEditContext } from "./slide-context.js";
import type { OrchestratorPlan, SubagentId } from "./orchestrator.js";
import { planSubagentKeywords } from "./orchestrator.js";
import { probeCursorAuth, runCursorAgentCli } from "./cursor-cli.js";

const VALID_SUBAGENTS: SubagentId[] = [
  "text-changes",
  "visual-design",
  "slide-editor",
  "image-generation",
];

function normalizeSubagent(value: string): SubagentId {
  const id = value.trim().toLowerCase().replace(/\s+/g, "-") as SubagentId;
  if (VALID_SUBAGENTS.includes(id)) return id;
  return "text-changes";
}

function parseOrchestratorJson(text: string): { subagent?: string; rationale?: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as { subagent?: string; rationale?: string };
  } catch {
    const match = trimmed.match(/\{[\s\S]*?"subagent"[\s\S]*?\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as { subagent?: string; rationale?: string };
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildPlanFromParsed(
  parsed: { subagent?: string; rationale?: string },
  routedBy: "cursor-cli",
  model?: string,
): OrchestratorPlan & { routedBy: "cursor-cli"; model?: string } {
  const subagent = normalizeSubagent(parsed.subagent ?? "text-changes");
  const rationale = parsed.rationale?.trim() || `Cursor CLI routed to ${subagent}`;
  const supportingSkills = new Set<SubagentId>(["code-resolver", subagent]);
  if (subagent === "image-generation") {
    supportingSkills.add("visual-design");
  }

  return {
    subagent,
    primarySkill:
      subagent === "image-generation" ? "visual-design" : (subagent as OrchestratorPlan["primarySkill"]),
    supportingSkills: [...supportingSkills],
    rationale: `[Cursor orchestrator] ${rationale}`,
    routedBy,
    model,
  };
}

function buildOrchestratorRoutingPrompt(
  directiveText: string,
  editContext?: CommentEditContext,
): string {
  const contextJson = editContext
    ? JSON.stringify(
        {
          slideId: editContext.slideId,
          field: editContext.field,
          targetElement: editContext.targetElement,
          instruction: editContext.instruction,
        },
        null,
        2,
      )
    : "{}";

  return [
    "You are the Better Slido orchestrator. Do NOT edit any files. Do NOT use tools.",
    "Reply with exactly one JSON object and nothing else:",
    '{"subagent":"<id>","rationale":"<one sentence>"}',
    "",
    "subagent must be one of:",
    "- text-changes (copy, titles, tags, bullet text, footers)",
    "- visual-design (colors, Tailwind, themes, bulletTextClass, layout)",
    "- slide-editor (add/remove slides, poll, Q&A, deck structure)",
    "- image-generation (photos, illustrations, generated slide assets)",
    "",
    `Directive: ${directiveText}`,
    `Slide context: ${contextJson}`,
  ].join("\n");
}

/**
 * Route the directive using a short Cursor CLI call (same auth as the editor subagent).
 */
export async function planSubagentWithCursorCli(
  directiveText: string,
  editContext: CommentEditContext | undefined,
  cwd: string,
): Promise<OrchestratorPlan & { routedBy: "cursor-cli" | "keywords"; model?: string; logs?: string[] }> {
  const auth = await probeCursorAuth();
  if (!auth.available) {
    const fallback = planSubagentKeywords(directiveText);
    return {
      ...fallback,
      routedBy: "keywords",
      logs: [...auth.logs, "[Orchestrator] Cursor CLI not authenticated — keyword fallback"],
    };
  }

  const timeoutMs = Number(process.env.ORCHESTRATOR_TIMEOUT_MS) || 120_000;
  const model = process.env.ORCHESTRATOR_MODEL?.trim() || process.env.CURSOR_AGENT_MODEL?.trim();
  const prompt = buildOrchestratorRoutingPrompt(directiveText, editContext);

  const cliResult = await runCursorAgentCli({
    prompt,
    cwd,
    authMode: auth.mode,
    timeoutMs,
    model,
    outputFormat: "json",
  });

  const routeLogs = [
    ...auth.logs,
    ...cliResult.logs,
    `[Orchestrator] Cursor CLI routing complete (${cliResult.durationMs ? Math.round(cliResult.durationMs / 1000) + "s" : "?"})`,
  ];

  const parsed =
    parseOrchestratorJson(cliResult.resultText) ||
    parseOrchestratorJson(cliResult.rawStdout);

  if (!cliResult.success || !parsed?.subagent) {
    const fallback = planSubagentKeywords(directiveText);
    return {
      ...fallback,
      routedBy: "keywords",
      logs: [
        ...routeLogs,
        `[Orchestrator] Cursor routing parse failed — keyword fallback (${cliResult.error ?? "no JSON"})`,
      ],
    };
  }

  return {
    ...buildPlanFromParsed(parsed, "cursor-cli", model),
    logs: routeLogs,
  };
}
