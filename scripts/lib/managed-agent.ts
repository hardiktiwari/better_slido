import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

function scanDirectory(dir: string, baseDir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== ".git" && file !== ".agents") {
        scanDirectory(filePath, baseDir, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (ext === ".ts" || ext === ".tsx") {
        fileList.push(path.relative(baseDir, filePath));
      }
    }
  }
  return fileList;
}

export const HARNESS_VERSION = "1.2.0";
export type HarnessSkill = "visual-design" | "text-changes" | "code-resolver" | "slide-editor";
export const BASE_AGENT = "antigravity-preview-05-2026";
export const DEFAULT_MANAGED_AGENT_ID = "better-slido-editor";
export const INTERACTION_TIMEOUT_MS = 300_000;
export const API_REVISION = "2026-05-20";

export interface AgentDirective {
  file: string;
  line: number;
  text: string;
  fullMatch: string;
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
}

interface EnvironmentSource {
  type: "inline" | "repository";
  target?: string;
  content?: string;
  source?: string;
}

interface ParsedAgentOutput {
  modifiedFilePath?: string;
  modifiedContent?: string;
  explanation?: string;
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

function readAgentsMd(cwd: string): string | null {
  const rootAgents = path.join(cwd, "AGENTS.md");
  const nestedAgents = path.join(cwd, ".agents/AGENTS.md");

  if (fs.existsSync(rootAgents)) {
    return fs.readFileSync(rootAgents, "utf-8");
  }
  if (fs.existsSync(nestedAgents)) {
    return fs.readFileSync(nestedAgents, "utf-8");
  }
  return null;
}

export function loadEnvironmentSources(cwd: string, extraSources: EnvironmentSource[] = []): EnvironmentSource[] {
  const sources: EnvironmentSource[] = [];

  const agentsContent = readAgentsMd(cwd);
  if (agentsContent) {
    sources.push({
      type: "inline",
      target: ".agents/AGENTS.md",
      content: agentsContent,
    });
  }

  const skillsDir = path.join(cwd, ".agents/skills");
  if (fs.existsSync(skillsDir)) {
    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, skillName, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        sources.push({
          type: "inline",
          target: `.agents/skills/${skillName}/SKILL.md`,
          content: fs.readFileSync(skillPath, "utf-8"),
        });
      }
    }
  }

  const repoUrl = process.env.BETTER_SLIDO_REPO_URL;
  if (repoUrl) {
    sources.push({
      type: "repository",
      source: repoUrl,
      target: "/workspace/repo",
    });
  }

  return [...sources, ...extraSources];
}

export function findAgentDirectives(filePath: string, relativeFile = "src/App.tsx"): AgentDirective[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n");
  const comments: AgentDirective[] = [];

  lines.forEach((line, idx) => {
    const match =
      line.match(/\/\/ @agent: (resolve|edit): (.*)/) ||
      line.match(/\{\/\* @agent: (resolve|edit): (.*) \*\/\}/);

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

function parseAgentOutput(outputText: string): ParsedAgentOutput | null {
  const lines = outputText.trim().split("\n").filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;

    try {
      const parsed = JSON.parse(line) as ParsedAgentOutput;
      if (parsed.modifiedContent) return parsed;
    } catch {
      // keep scanning upward
    }
  }

  const jsonMatch = outputText.match(/\{[\s\S]*"modifiedContent"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as ParsedAgentOutput;
    } catch {
      return null;
    }
  }

  return null;
}

function buildInlineWorkspaceSources(cwd: string, relativeFile: string): EnvironmentSource[] {
  const absolutePath = path.join(cwd, relativeFile);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found at ${absolutePath}`);
  }

  return [
    {
      type: "inline",
      target: `/workspace/repo/${relativeFile}`,
      content: fs.readFileSync(absolutePath, "utf-8"),
    },
  ];
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

function buildSystemInstruction(primarySkill: HarnessSkill): string {
  return [
    "You are the Better Slido managed code editor running on the Antigravity agent harness.",
    "Use code execution to edit files under /workspace/repo/.",
    "Follow AGENTS.md and the mounted skills under .agents/skills/.",
    `Primary skill for this task: ${primarySkill}. Also use code-resolver for @agent tag workflow.`,
    "When resolving @agent directives, mark them as resolved and return the output JSON contract.",
  ].join(" ");
}

function buildInteractionInput(
  directive: AgentDirective,
  codeSnippet: string,
  primarySkill: HarnessSkill,
): string {
  const supportingSkills = new Set<HarnessSkill>(["code-resolver", primarySkill]);
  if (primarySkill !== "slide-editor" && SLIDE_STRUCTURE_KEYWORDS.some((k) => directive.text.toLowerCase().includes(k))) {
    supportingSkills.add("slide-editor");
  }

  return [
    `Resolve the @agent directive in ${directive.file} at line ${directive.line}.`,
    `Instruction: "${directive.text}"`,
    `Primary skill: ${primarySkill}`,
    `Supporting skills: ${[...supportingSkills].join(", ")}`,
    "",
    "Surrounding code context:",
    "```tsx",
    codeSnippet,
    "```",
    "",
    "Steps:",
    `1. Read .agents/skills/${primarySkill}/SKILL.md and follow it.`,
    "2. Use code-resolver for the resolve → resolved tag workflow.",
    `3. Edit /workspace/repo/${directive.file} in the remote workspace.`,
    `4. End with a single JSON line: {"modifiedFilePath":"${directive.file}","modifiedContent":"...","explanation":"..."}`,
  ].join("\n");
}

export async function runManagedAgent(cwd: string): Promise<ManagedAgentResult> {
  const logs: string[] = [
    `Better Slido - Managed Agent Harness [v${HARNESS_VERSION}]`,
    `Base agent: ${BASE_AGENT}`,
    `Scanning workspace for @agent directives...`,
  ];

  const filesToScan = scanDirectory(cwd, cwd);
  let directives: AgentDirective[] = [];
  for (const relFile of filesToScan) {
    const absPath = path.join(cwd, relFile);
    directives = [...directives, ...findAgentDirectives(absPath, relFile)];
  }

  if (directives.length === 0) {
    logs.push(`No active '@agent: resolve:' tags found in the workspace.`);
    logs.push(`Tip: Add // @agent: resolve: your instruction and re-run.`);
    return {
      success: true,
      applied: false,
      logs,
      commentsFound: 0,
      skill: undefined,
    };
  }

  const directive = directives[0];
  const primarySkill = pickSkillForDirective(directive.text);
  logs.push(`[FOUND] Directive in ${directive.file} on line ${directive.line}: "${directive.text}"`);
  logs.push(`[SKILL] Routed to: ${primarySkill}`);
  logs.push(`Booting Antigravity managed agent (remote sandbox)...`);

  const fileContent = fs.readFileSync(path.join(cwd, directive.file), "utf-8");
  const lines = fileContent.split("\n");
  const startLine = Math.max(0, directive.line - 15);
  const endLine = Math.min(lines.length, directive.line + 15);
  const codeSnippet = lines.slice(startLine, endLine).join("\n");

  const client = createGenAIClient();
  const managedAgentId = process.env.MANAGED_AGENT_ID;
  const workspaceSources = buildInlineWorkspaceSources(cwd, directive.file);
  const environmentSources = loadEnvironmentSources(cwd, workspaceSources);

  const interactionConfig: Record<string, unknown> = {
    input: buildInteractionInput(directive, codeSnippet, primarySkill),
    system_instruction: buildSystemInstruction(primarySkill),
    tools: [{ type: "code_execution" }, { type: "google_search" }, { type: "url_context" }],
    environment: {
      type: "remote",
      sources: environmentSources,
    },
  };

  if (managedAgentId) {
    interactionConfig.agent = managedAgentId;
    logs.push(`Using saved managed agent: ${managedAgentId}`);
  } else {
    interactionConfig.agent = BASE_AGENT;
    logs.push(`Using inline Antigravity agent configuration`);
  }

  logs.push(`Mounted ${environmentSources.length} environment source(s)`);
  logs.push(`Invoking client.interactions.create() (timeout ${INTERACTION_TIMEOUT_MS / 1000}s)...`);

  const interaction = await client.interactions.create(
    interactionConfig as Parameters<typeof client.interactions.create>[0],
    { timeout: INTERACTION_TIMEOUT_MS },
  );

  const outputText = interaction.output_text ?? "";
  logs.push(`Interaction complete${interaction.id ? ` (id: ${interaction.id})` : ""}.`);

  const parsed = parseAgentOutput(outputText);
  if (!parsed?.modifiedContent) {
    logs.push(`[WARN] Agent did not return parseable modifiedContent JSON.`);
    logs.push(`Raw output preview: ${outputText.slice(0, 500)}${outputText.length > 500 ? "…" : ""}`);
    return {
      success: true,
      applied: false,
      explanation: outputText.slice(0, 1000) || "No output from managed agent.",
      outputText,
      interactionId: interaction.id,
      logs,
      commentsFound: directives.length,
      directive,
      skill: primarySkill,
    };
  }

  const targetRelativePath = parsed.modifiedFilePath ?? directive.file;
  const targetAbsolutePath = path.join(cwd, targetRelativePath);
  fs.writeFileSync(targetAbsolutePath, parsed.modifiedContent, "utf-8");

  logs.push(`[SUCCESS] Wrote ${targetRelativePath} (${parsed.modifiedContent.length} bytes)`);
  logs.push(`[RESOLVED] ${parsed.explanation ?? directive.text}`);

  return {
    success: true,
    applied: true,
    explanation: parsed.explanation,
    outputText,
    interactionId: interaction.id,
    logs,
    commentsFound: directives.length,
    directive,
    skill: primarySkill,
  };
}

export async function registerManagedAgent(cwd: string, agentId = DEFAULT_MANAGED_AGENT_ID): Promise<string> {
  const client = createGenAIClient();
  const environmentSources = loadEnvironmentSources(cwd);

  const agent = await client.agents.create({
    id: agentId,
    base_agent: BASE_AGENT,
    system_instruction: buildSystemInstruction("text-changes"),
    base_environment: {
      type: "remote",
      sources: environmentSources,
    },
    tools: [{ type: "code_execution" }, { type: "google_search" }, { type: "url_context" }],
  } as Parameters<typeof client.agents.create>[0]);

  return agent.id ?? agentId;
}
