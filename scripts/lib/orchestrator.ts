import fs from "fs";
import path from "path";
import type { AgentDirective } from "./managed-agent.js";
import type { HarnessSkill } from "./managed-agent.js";
import { pickSkillForDirective } from "./managed-agent.js";
import {
  buildFocusedContextPrompt,
  type CommentEditContext,
} from "./slide-context.js";

/** Subagents the orchestrator can delegate to (maps to `.agents/skills/*`). */
export type SubagentId =
  | "code-resolver"
  | "text-changes"
  | "visual-design"
  | "slide-editor"
  | "image-generation";

const IMAGE_KEYWORDS = [
  "image",
  "imagen",
  "picture",
  "photo",
  "illustration",
  "graphic",
  "icon asset",
  "generate art",
  "zebra",
  "diagram asset",
];

export interface OrchestratorPlan {
  subagent: SubagentId;
  primarySkill: HarnessSkill;
  supportingSkills: SubagentId[];
  rationale: string;
}

const COLOR_STYLE_KEYWORDS = ["color", "colour", "red", "blue", "green", "yellow", "purple", "orange", "tailwind", "background", "text-"];

/** Keyword-based routing (fallback when LLM orchestrator is off or fails). */
export function planSubagentKeywords(directiveText: string): OrchestratorPlan {
  const lower = directiveText.toLowerCase();

  if (COLOR_STYLE_KEYWORDS.some((k) => lower.includes(k))) {
    return {
      subagent: "visual-design",
      primarySkill: "visual-design",
      supportingSkills: ["code-resolver", "visual-design"],
      rationale: "Directive mentions color or styling",
    };
  }

  if (IMAGE_KEYWORDS.some((k) => lower.includes(k))) {
    return {
      subagent: "image-generation",
      primarySkill: "visual-design",
      supportingSkills: ["image-generation", "code-resolver", "visual-design"],
      rationale: "Directive mentions generated or slide imagery",
    };
  }

  const primarySkill = pickSkillForDirective(directiveText);
  const subagent = primarySkill as SubagentId;

  const supportingSkills = new Set<SubagentId>(["code-resolver", subagent]);
  if (subagent !== "slide-editor" && /add slide|new slide|poll|q&a|deck/.test(lower)) {
    supportingSkills.add("slide-editor");
  }

  return {
    subagent,
    primarySkill,
    supportingSkills: [...supportingSkills],
    rationale: `Routed from directive keywords → ${primarySkill}`,
  };
}

function readSkillMd(cwd: string, skillId: SubagentId): string {
  const skillPath = path.join(cwd, ".agents", "skills", skillId, "SKILL.md");
  if (!fs.existsSync(skillPath)) return "";
  return fs.readFileSync(skillPath, "utf-8");
}

function readAgentsMd(cwd: string): string {
  const root = path.join(cwd, "AGENTS.md");
  const nested = path.join(cwd, ".agents", "AGENTS.md");
  if (fs.existsSync(root)) return fs.readFileSync(root, "utf-8");
  if (fs.existsSync(nested)) return fs.readFileSync(nested, "utf-8");
  return "";
}

export function buildSubagentPrompt(
  cwd: string,
  directive: AgentDirective,
  codeSnippet: string,
  plan: OrchestratorPlan,
  editContext?: CommentEditContext,
): string {
  const primarySkillDoc = readSkillMd(cwd, plan.subagent);
  const resolverSnippet = readSkillMd(cwd, "code-resolver").slice(0, 1200);

  const focused = editContext ? buildFocusedContextPrompt(editContext) : null;

  return [
    "# Better Slido — Cursor subagent task",
    "",
    "You are invoked by the **orchestrator** as the `" + plan.subagent + "` subagent.",
    `Orchestrator rationale: ${plan.rationale}`,
    "",
    "## Rules",
    "1. Edit `src/App.tsx` only unless generating assets under `public/generated/`.",
    `2. Directive at **${directive.file} line ${directive.line}**: \`${directive.fullMatch}\``,
    '3. Implement the instruction, then rewrite `// @agent: resolve:` → `// @agent: resolved:` (keep the instruction text).',
    "4. Minimal diff only.",
    "5. Valid TSX.",
    focused
      ? [
          "",
          focused,
          "",
          "## code-resolver (excerpt)",
          resolverSnippet || "(not found)",
        ].join("\n")
      : [
          "",
          "## AGENTS.md",
          readAgentsMd(cwd).slice(0, 2500) || "(not found)",
          "",
          "## Directive instruction",
          directive.text,
          "",
          "## Surrounding code (~30 lines)",
          "```tsx",
          codeSnippet,
          "```",
        ].join("\n"),
    "",
    "## Primary skill (" + plan.subagent + ")",
    primarySkillDoc ? primarySkillDoc.slice(0, focused ? 2500 : 6000) : "(SKILL.md not found)",
    "",
    plan.subagent === "image-generation"
      ? [
          "## Image subagent",
          "- Prefer `public/generated/` (e.g. `/generated/slide-bg.jpg`).",
          "- Wire styles or `img` on the slide in the excerpt above.",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOrchestratorLogs(
  plan: OrchestratorPlan,
  directive: AgentDirective,
  editContext?: CommentEditContext,
  extra?: { routedBy?: string; model?: string },
): string[] {
  const contextLine = editContext
    ? `[Orchestrator] Focused context: ${editContext.slideId} field=${editContext.field} lines ${editContext.sourceStartLine}-${editContext.sourceEndLine}`
    : "[Orchestrator] No focused context (legacy prompt)";
  const routeLine = extra?.routedBy
    ? `[Orchestrator] Router: ${extra.routedBy}${extra.model ? ` (${extra.model})` : ""}`
    : "[Orchestrator] Router: keywords";
  return [
    "[Orchestrator] Better Slido agent router",
    routeLine,
    `[Orchestrator] Directive: ${directive.file}:${directive.line} — "${directive.text}"`,
    `[Orchestrator] Subagent: ${plan.subagent}`,
    `[Orchestrator] Rationale: ${plan.rationale}`,
    contextLine,
  ];
}

/** @deprecated Use planSubagentAsync */
export function planSubagent(directiveText: string): OrchestratorPlan {
  return planSubagentKeywords(directiveText);
}

export type OrchestratorRoutedBy = "cursor-cli" | "gemini" | "keywords";

export type OrchestratorRouteResult = OrchestratorPlan & {
  routedBy: OrchestratorRoutedBy;
  model?: string;
  logs?: string[];
};

/** Default: keyword router (fast, one CLI run). ORCHESTRATOR_MODE=cursor|gemini to override. */
export async function planSubagentAsync(
  directiveText: string,
  editContext?: CommentEditContext,
  cwd: string = process.cwd(),
): Promise<OrchestratorRouteResult> {
  const mode =
    process.env.ORCHESTRATOR_MODE?.trim().toLowerCase() || "keywords";

  if (mode === "keywords") {
    return { ...planSubagentKeywords(directiveText), routedBy: "keywords" };
  }

  if (mode === "gemini") {
    const { planSubagentWithLlm } = await import("./orchestrator-llm.js");
    const result = await planSubagentWithLlm(directiveText, editContext);
    return { ...result, routedBy: "gemini" as const };
  }

  const { planSubagentWithCursorCli } = await import("./orchestrator-cursor.js");
  return planSubagentWithCursorCli(directiveText, editContext, cwd);
}
