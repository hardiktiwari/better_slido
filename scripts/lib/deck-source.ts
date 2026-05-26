import fs from "fs";
import path from "path";

export type SlideSourcePatch = Partial<{
  tag: string;
  title: string;
  subtitle: string;
  bulletTextClass: string;
  subtitleClass: string;
  imageUrl: string;
  footerLeft: string;
  footerRight: string;
  bullets: Array<{ text: string; icon: string }>;
  pollOptions: Array<{ text: string; votes: number }>;
}>;

function extractSlideBlock(content: string, slideId: string): string | undefined {
  const lines = content.split("\n");
  const idIdx = lines.findIndex(
    (l) => l.includes(`id: '${slideId}'`) || l.includes(`id: "${slideId}"`),
  );
  if (idIdx === -1) return undefined;

  let start = idIdx;
  while (start > 0 && !/^\s{2}\{\s*$/.test(lines[start])) start--;
  let end = idIdx;
  while (end < lines.length - 1) {
    end++;
    if (/^\s{2}\},?\s*$/.test(lines[end])) break;
  }
  return lines.slice(start, end + 1).join("\n");
}

function parseQuotedString(raw: string): string {
  return raw.replace(/\\'/g, "'");
}

function parseObjectArray<T>(
  block: string,
  key: string,
  itemPattern: RegExp,
  mapItem: (m: RegExpExecArray) => T,
): T[] | undefined {
  const keyIdx = block.indexOf(`${key}: [`);
  if (keyIdx === -1) return undefined;

  let depth = 0;
  let i = block.indexOf("[", keyIdx);
  const begin = i;
  for (; i < block.length; i++) {
    if (block[i] === "[") depth++;
    else if (block[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const arrText = block.slice(begin, i + 1);
  const items: T[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(itemPattern.source, itemPattern.flags.includes("g") ? itemPattern.flags : `${itemPattern.flags}g`);
  while ((m = re.exec(arrText))) {
    items.push(mapItem(m));
  }
  return items.length > 0 ? items : undefined;
}

/** Read agent-applied slide fields from src/App.tsx (source of truth after harness runs). */
export function readSlideFieldsFromApp(cwd: string, slideId: string): SlideSourcePatch {
  const appPath = path.join(cwd, "src/App.tsx");
  if (!fs.existsSync(appPath)) return {};

  const block = extractSlideBlock(fs.readFileSync(appPath, "utf-8"), slideId);
  if (!block) return {};

  const out: SlideSourcePatch = {};
  const tag = block.match(/tag:\s*'([^']*)'/);
  if (tag) out.tag = parseQuotedString(tag[1]);
  const title = block.match(/title:\s*'([^']*)'/);
  if (title) out.title = parseQuotedString(title[1]);
  const subtitle = block.match(/subtitle:\s*'([^']*)'/);
  if (subtitle) out.subtitle = parseQuotedString(subtitle[1]);
  const bulletTextClass = block.match(/bulletTextClass:\s*'([^']*)'/);
  if (bulletTextClass) out.bulletTextClass = bulletTextClass[1];
  const subtitleClass = block.match(/subtitleClass:\s*'([^']*)'/);
  if (subtitleClass) out.subtitleClass = subtitleClass[1];
  const imageUrl = block.match(/imageUrl:\s*'([^']*)'/);
  if (imageUrl) out.imageUrl = imageUrl[1];
  const footerLeft = block.match(/footerLeft:\s*'([^']*)'/);
  if (footerLeft) out.footerLeft = parseQuotedString(footerLeft[1]);
  const footerRight = block.match(/footerRight:\s*'([^']*)'/);
  if (footerRight) out.footerRight = parseQuotedString(footerRight[1]);

  const bullets = parseObjectArray(
    block,
    "bullets",
    /\{\s*text:\s*'((?:\\'|[^'])*)'\s*,\s*icon:\s*'([^']*)'\s*\}/,
    (m) => ({ text: parseQuotedString(m[1]), icon: m[2] }),
  );
  if (bullets) out.bullets = bullets;

  const pollOptions = parseObjectArray(
    block,
    "pollOptions",
    /\{\s*text:\s*'((?:\\'|[^'])*)'\s*,\s*votes:\s*(\d+)\s*\}/,
    (m) => ({ text: parseQuotedString(m[1]), votes: Number(m[2]) }),
  );
  if (pollOptions) out.pollOptions = pollOptions;

  return out;
}
