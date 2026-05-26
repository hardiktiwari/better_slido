import { GoogleGenAI, Type } from "@google/genai";
import type { CommentEditContext } from "./slide-context.js";
import type { OrchestratorPlan, SubagentId } from "./orchestrator.js";
import { planSubagentKeywords } from "./orchestrator.js";

const VALID_SUBAGENTS: SubagentId[] = [
  "text-changes",
  "visual-design",
  "slide-editor",
  "image-generation",
];

function createOrchestratorClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "better-slido-orchestrator" } },
  });
}

function normalizeSubagent(value: string): SubagentId {
  const id = value.trim().toLowerCase() as SubagentId;
  if (VALID_SUBAGENTS.includes(id)) return id;
  return "text-changes";
}

export interface LlmOrchestratorResult extends OrchestratorPlan {
  routedBy: "gemini" | "keywords";
  model?: string;
}

/**
 * Route the directive to a subagent using Gemini (structured JSON).
 * Falls back to keyword routing if no API key or the call fails.
 */
export async function planSubagentWithLlm(
  directiveText: string,
  editContext?: CommentEditContext,
): Promise<LlmOrchestratorResult> {
  const client = createOrchestratorClient();
  if (!client) {
    const fallback = planSubagentKeywords(directiveText);
    return { ...fallback, routedBy: "keywords" };
  }

  const model = process.env.ORCHESTRATOR_MODEL?.trim() || "gemini-3.5-flash";
  const contextBlock = editContext
    ? [
        `slideId: ${editContext.slideId}`,
        `field: ${editContext.field}`,
        `targetElement: ${editContext.targetElement}`,
        `instruction: ${editContext.instruction}`,
      ].join("\n")
    : "(no slide context)";

  const systemInstruction = `You are the Better Slido orchestrator. Your only job is to choose which specialist subagent should handle a slide comment directive.

Subagents (pick exactly one):
- text-changes: copy, titles, tags, bullets text, footers, strings
- visual-design: colors, Tailwind classes, themes, layout, bulletTextClass, styling
- slide-editor: add/remove slides, poll/Q&A structure, deck changes
- image-generation: generate or add photos, illustrations, diagrams, icons as assets

Return JSON only. Be concise in rationale.`;

  const userPrompt = `Directive text:\n${directiveText}\n\nSlide context:\n${contextBlock}`;

  try {
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["subagent", "rationale"],
          properties: {
            subagent: {
              type: Type.STRING,
              description: "One of: text-changes, visual-design, slide-editor, image-generation",
            },
            rationale: {
              type: Type.STRING,
              description: "One sentence why this subagent fits",
            },
          },
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) throw new Error("Empty orchestrator LLM response");

    const parsed = JSON.parse(raw) as { subagent?: string; rationale?: string };
    const subagent = normalizeSubagent(parsed.subagent ?? "text-changes");
    const rationale = parsed.rationale?.trim() || `LLM routed to ${subagent}`;

    const supportingSkills = new Set<SubagentId>(["code-resolver", subagent]);
    if (subagent === "image-generation") {
      supportingSkills.add("visual-design");
    }

    return {
      subagent,
      primarySkill:
        subagent === "image-generation" ? "visual-design" : (subagent as OrchestratorPlan["primarySkill"]),
      supportingSkills: [...supportingSkills],
      rationale: `[Gemini orchestrator] ${rationale}`,
      routedBy: "gemini",
      model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = planSubagentKeywords(directiveText);
    return {
      ...fallback,
      rationale: `${fallback.rationale} (LLM fallback: ${message})`,
      routedBy: "keywords",
    };
  }
}
