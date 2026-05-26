import fs from "fs";
import path from "path";

/** Payload the UI sends with each comment (live deck state). */
export interface CommentWebhookPayload {
  slideId: string;
  slideIndex?: number;
  field?: string;
  targetElement?: string;
  slide?: {
    id: string;
    type: string;
    tag?: string;
    title?: string;
    subtitle?: string;
    bullets?: Array<{ text: string; icon?: string }>;
    pollOptions?: Array<{ text: string; votes?: number }>;
    footerLeft?: string;
    footerRight?: string;
    bulletTextClass?: string;
    imageUrl?: string;
  };
}

/** Fully resolved context passed to the orchestrator / Cursor CLI prompt. */
export interface CommentEditContext {
  slideId: string;
  slideIndex: number;
  field: string;
  targetElement: string;
  instruction: string;
  directiveLine?: number;
  currentValues: Record<string, unknown>;
  sourceFile: string;
  sourceStartLine: number;
  sourceEndLine: number;
  sourceExcerpt: string;
  lineCount: number;
}

export function extractSlideBlock(
  lines: string[],
  slideId: string,
): { startLine: number; endLine: number } {
  const idIdx = lines.findIndex(
    (line) => line.includes(`id: '${slideId}'`) || line.includes(`id: "${slideId}"`),
  );
  if (idIdx === -1) {
    return { startLine: 1, endLine: Math.min(80, lines.length) };
  }

  let start = idIdx;
  while (start > 0) {
    if (/^\s{2}\{\s*$/.test(lines[start])) break;
    start--;
  }

  let end = idIdx;
  while (end < lines.length - 1) {
    end++;
    if (/^\s{2}\},?\s*$/.test(lines[end])) break;
  }

  return { startLine: start + 1, endLine: end + 1 };
}

function formatNumberedExcerpt(lines: string[], startLine: number, endLine: number): string {
  return lines
    .slice(startLine - 1, endLine)
    .map((line, i) => `${String(startLine + i).padStart(4)}| ${line}`)
    .join("\n");
}

function fieldFocusHint(field: string, targetElement: string): string {
  if (field.startsWith("bullet-")) {
    const idx = Number(field.split("-")[1]);
    return [
      `Edit bullets[${idx}] text in DEFAULT_DECK when the instruction changes words.`,
      `For color/style on bullets (red, blue, etc.), set slide-level \`bulletTextClass\` to a static CSS class (e.g. \`slide-bullet-red\` or \`slide-bullet-blue\`) on this slide object — do not only change one bullet string.`,
    ].join(" ");
  }
  if (field.startsWith("poll-")) {
    const idx = Number(field.split("-")[1]);
    return `Edit pollOptions[${idx}] in DEFAULT_DECK.`;
  }
  const map: Record<string, string> = {
    title: "Edit the `title` string in this slide object.",
    subtitle: "Edit the `subtitle` string in this slide object.",
    tag: "Edit the `tag` string in this slide object.",
    footerLeft: "Edit `footerLeft`.",
    footerRight: "Edit `footerRight`.",
    slide: "Edit fields on this slide as needed for the instruction.",
    general: `Focus on the ${targetElement} area of this slide.`,
  };
  return map[field] ?? map.general;
}

export function buildCommentEditContext(
  cwd: string,
  payload: CommentWebhookPayload,
  commentText: string,
  directiveLine?: number,
): CommentEditContext {
  const sourceFile = "src/App.tsx";
  const appPath = path.join(cwd, sourceFile);
  const lines = fs.readFileSync(appPath, "utf-8").split("\n");
  const slideId = payload.slideId ?? "slide-1";
  const { startLine, endLine } = extractSlideBlock(lines, slideId);

  const targetElement = payload.targetElement ?? "general";
  const field = payload.field ?? targetElement;

  return {
    slideId,
    slideIndex: payload.slideIndex ?? 0,
    field,
    targetElement,
    instruction: commentText.replace(/\s+/g, " ").trim(),
    directiveLine,
    currentValues: (payload.slide ?? { id: slideId }) as Record<string, unknown>,
    sourceFile,
    sourceStartLine: startLine,
    sourceEndLine: endLine,
    sourceExcerpt: formatNumberedExcerpt(lines, startLine, endLine),
    lineCount: endLine - startLine + 1,
  };
}

export function buildFocusedContextPrompt(ctx: CommentEditContext): string {
  return [
    "## Comment context (authoritative — do not search the full repo)",
    "",
    "| Key | Value |",
    "|-----|-------|",
    `| slideId | ${ctx.slideId} |`,
    `| slideIndex | ${ctx.slideIndex} (0-based in DEFAULT_DECK) |`,
    `| field | ${ctx.field} |`,
    `| targetElement | ${ctx.targetElement} |`,
    `| directiveLine | ${ctx.directiveLine ?? "(see excerpt)"} |`,
    `| sourceLines | ${ctx.sourceFile} ${ctx.sourceStartLine}-${ctx.sourceEndLine} (${ctx.lineCount} lines) |`,
    "",
    "### Instruction",
    ctx.instruction,
    "",
    "### Field focus",
    fieldFocusHint(ctx.field, ctx.targetElement),
    "",
    "### Current UI values (from presenter at comment time)",
    "```json",
    JSON.stringify(ctx.currentValues, null, 2),
    "```",
    "",
    `### Source excerpt ONLY (\`${ctx.sourceFile}\` lines ${ctx.sourceStartLine}-${ctx.sourceEndLine})`,
    "Edit **only** this slide block in `DEFAULT_DECK`. Mark the `// @agent: resolve:` line as `resolved:` after editing.",
    "",
    "```tsx",
    ctx.sourceExcerpt,
    "```",
    "",
    "### Speed rules",
    "- Do NOT read all of App.tsx — the excerpt above is sufficient.",
    "- Do NOT refactor unrelated slides or components.",
    "- Apply the minimal change, then stop.",
  ].join("\n");
}
