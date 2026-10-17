import { normalizeWikiHeading } from "@/features/wiki/utils/wiki";
import type { NoteNavigationTarget } from "@/stores/session.store";

interface SourceLine { line: number; text: string }

/** 提取参与标题匹配的源码行：跳过 frontmatter、围栏代码与围栏标记行。 */
function markdownBodyLines(markdown: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let inFrontmatter = false;
  let inFence = false;
  for (const [index, raw] of markdown.split("\n").entries()) {
    const line = raw.trim();
    if (index === 0 && line === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) { if (line === "---") inFrontmatter = false; continue; }
    if (line.startsWith("```") || line.startsWith("~~~")) { inFence = !inFence; continue; }
    if (inFence) continue;
    lines.push({ line: index + 1, text: line });
  }
  return lines;
}

/** 在 Markdown 源码中查找标题行（1 起），忽略 frontmatter 与围栏代码。 */
export function findMarkdownHeadingLine(markdown: string, heading: string | null | undefined): number | null {
  if (!heading) return null;
  const needle = normalizeWikiHeading(heading);
  for (const source of markdownBodyLines(markdown)) {
    const match = /^#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(source.text);
    if (match && normalizeWikiHeading(match[1] ?? "") === needle) return source.line;
  }
  return null;
}

/** 计算导航落点：显式行号优先，其次标题；都找不到返回 null。 */
export function markdownNavigationLine(markdown: string, target: NoteNavigationTarget): number | null {
  if (target.line && target.line > 0) return target.line;
  return findMarkdownHeadingLine(markdown, target.heading);
}

/** 从引用的多行上下文中提取可在 TipTap 文本节点内匹配的首个非空行。 */
export function citationQuote(text: string): string | null {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean);
  if (!line) return null;
  const cleaned = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~[\]]/g, "")
    .trim();
  return cleaned || null;
}
