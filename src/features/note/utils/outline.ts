import { slugifyHeading } from "./preview";

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
  line: number;
}

/** 提取 Markdown 标题大纲，忽略代码围栏与顶部 frontmatter。 */
export function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  let inFrontmatter = false;
  const ids = new Map<string, number>();
  for (const [index, rawLine] of markdown.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    const state = updateFenceState(line, inFence, inFrontmatter, index);
    inFence = state.inFence;
    inFrontmatter = state.inFrontmatter;
    if (state.skip) continue;
    const item = parseHeading(line, index + 1, ids);
    if (item) items.push(item);
  }
  return items;
}

function updateFenceState(line: string, inFence: boolean, inFrontmatter: boolean, index: number) {
  if (index === 0 && line.trim() === "---") return { inFence, inFrontmatter: true, skip: true };
  if (inFrontmatter) return { inFence, inFrontmatter: line.trim() !== "---", skip: true };
  if (/^\s{0,3}(```|~~~)/.test(line)) return { inFence: !inFence, inFrontmatter, skip: true };
  return { inFence, inFrontmatter, skip: inFence };
}

function parseHeading(line: string, lineNumber: number, ids: Map<string, number>): OutlineItem | null {
  const match = /^( {0,3})(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
  if (!match?.[2] || !match[3]) return null;
  const text = stripInlineMarkdown(match[3]);
  if (!text) return null;
  const base = slugifyHeading(text);
  const count = ids.get(base) ?? 0;
  ids.set(base, count + 1);
  return { id: count === 0 ? base : `${base}-${count + 1}`, text, level: match[2].length, line: lineNumber };
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/[`*_~]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
}
