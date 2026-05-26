import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import type { CommentEditContext } from "./slide-context.js";

export type HarnessSkill = "visual-design" | "text-changes" | "code-resolver" | "slide-editor";

export const API_REVISION = "2026-05-20";

export interface AgentProgressUpdate {
  stage?: "routing" | "subagent" | "running" | "done";
  subagent?: string;
  primarySkill?: string;
  rationale?: string;
  routedBy?: string;
  toolsCalled?: string[];
  reasoningDelta?: string;
  activityLines?: string[];
}

export interface RunManagedAgentOptions {
  preferLine?: number;
  editContext?: CommentEditContext;
  /** When set, harness reports orchestrator/subagent progress for UI polling. */
  onProgress?: (update: AgentProgressUpdate) => void;
}

export interface AgentDirective {
  file: string;
  line: number;
  text: string;
  fullMatch: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  filename: string;
}

export interface ManagedAgentResult {
  success: boolean;
  applied: boolean;
  explanation?: string;
  outputText?: string;
  interactionId?: string;
  logs: string[];
  commentsFound: number;
  directive?: AgentDirective;
  skill?: HarnessSkill;
  imageGenerations?: ImageGenerationRequest[];
}

export function createGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "better-slido-agent-harness",
        "Api-Revision": API_REVISION,
      },
    },
  });
}

export function findAgentDirectives(filePath: string, relativeFile = "src/App.tsx"): AgentDirective[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n");
  const comments: AgentDirective[] = [];

  lines.forEach((line, idx) => {
    const match =
      line.match(/^\s*\/\/ @agent: (resolve|edit): (.*)/) ||
      line.match(/^\s*\{\/\* @agent: (resolve|edit): (.*) \*\/\}/);

    if (match) {
      comments.push({
        file: relativeFile,
        line: idx + 1,
        text: match[2].trim(),
        fullMatch: match[0],
      });
    }
  });

  return comments;
}

function normalizeDirectiveNeedle(text: string): string {
  return text
    .replace(/@agent/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function findWebhookDirectiveLine(
  filePath: string,
  agentComment: string,
  slideId?: string,
): number | undefined {
  const directives = findAgentDirectives(filePath);
  if (directives.length === 0) return undefined;

  const needle = normalizeDirectiveNeedle(agentComment);

  const byText = directives.filter((d) => {
    const hay = normalizeDirectiveNeedle(d.text);
    return (
      hay.includes(needle) ||
      needle.includes(hay) ||
      (hay.length > 12 && needle.includes(hay.slice(0, 40)))
    );
  });
  if (byText.length === 1) return byText[0].line;
  if (byText.length > 1) return byText[byText.length - 1].line;

  if (slideId) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const idIdx = lines.findIndex(
      (line) => line.includes(`id: '${slideId}'`) || line.includes(`id: "${slideId}"`),
    );
    if (idIdx !== -1) {
      const aboveId = directives.filter((d) => d.line <= idIdx + 1);
      if (aboveId.length) return aboveId[aboveId.length - 1].line;
    }
  }

  return directives[directives.length - 1].line;
}

const VISUAL_KEYWORDS = [
  "theme",
  "color",
  "colour",
  "layout",
  "style",
  "visual",
  "design",
  "font",
  "spacing",
  "background",
  "tailwind",
  "dark",
  "pastel",
  "editorial",
  "gradient",
  "shadow",
  "border",
  "padding",
  "margin",
  "contrast",
];

const TEXT_KEYWORDS = [
  "text",
  "title",
  "subtitle",
  "bullet",
  "copy",
  "wording",
  "rename",
  "nickname",
  "headline",
  "footer",
  "tag",
  "label",
  "placeholder",
  "rewrite",
  "word",
  "string",
  "initial",
  "default",
  "usestate",
];

const SLIDE_STRUCTURE_KEYWORDS = [
  "add slide",
  "new slide",
  "remove slide",
  "delete slide",
  "poll",
  "q&a",
  "qa slide",
  "deck",
  "reorder",
];

export function pickSkillForDirective(text: string): HarnessSkill {
  const lower = text.toLowerCase();

  if (SLIDE_STRUCTURE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "slide-editor";
  }
  if (VISUAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "visual-design";
  }
  if (TEXT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "text-changes";
  }

  return "text-changes";
}
