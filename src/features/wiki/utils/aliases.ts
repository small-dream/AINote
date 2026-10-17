import { parse, stringify } from "yaml";

interface MarkdownParts {
  frontmatter: string | null;
  body: string;
  eol: "\n" | "\r\n";
}

/** 拆分 Markdown frontmatter 与正文；无 frontmatter 时 frontmatter 为 null。 */
export function splitMarkdownFrontmatter(markdown: string): MarkdownParts {
  const opening = /^---(\r\n|\n)/.exec(markdown);
  if (!opening) return { frontmatter: null, body: markdown, eol: detectEol(markdown) };
  const eol: "\n" | "\r\n" = opening[1] === "\r\n" ? "\r\n" : "\n";
  const contentStart = opening[0].length;
  let lineStart = contentStart;
  while (lineStart <= markdown.length) {
    const lineEnd = markdown.indexOf(eol, lineStart);
    const line = lineEnd === -1 ? markdown.slice(lineStart) : markdown.slice(lineStart, lineEnd);
    if (line === "---") {
      const body = lineEnd === -1 ? "" : markdown.slice(lineEnd + eol.length);
      return { frontmatter: markdown.slice(contentStart, lineStart), body, eol };
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + eol.length;
  }
  return { frontmatter: null, body: markdown, eol };
}

function detectEol(markdown: string): "\n" | "\r\n" {
  return markdown.includes("\r\n") ? "\r\n" : "\n";
}

function frontmatterData(frontmatter: string | null): { data: Record<string, unknown>; valid: boolean } {
  if (frontmatter === null || !frontmatter.trim()) return { data: {}, valid: true };
  try {
    const parsed = parse(frontmatter);
    if (parsed === null) return { data: {}, valid: true };
    return typeof parsed === "object" && !Array.isArray(parsed)
      ? { data: parsed as Record<string, unknown>, valid: true }
      : { data: {}, valid: false };
  } catch {
    return { data: {}, valid: false };
  }
}

/** 从 Markdown frontmatter 读取 aliases（支持字符串数组与单个字符串）。 */
export function parseMarkdownAliases(markdown: string): string[] {
  const value = frontmatterData(splitMarkdownFrontmatter(markdown).frontmatter).data.aliases;
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 写入标准 aliases frontmatter；空数组时移除该字段，正文保持不变。 */
export function writeMarkdownAliases(markdown: string, aliases: string[]): string {
  const { frontmatter, body, eol } = splitMarkdownFrontmatter(markdown);
  const { data, valid } = frontmatterData(frontmatter);
  if (frontmatter !== null && !valid) return markdown;
  const normalized = [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
  if (normalized.length > 0) data.aliases = normalized;
  else delete data.aliases;
  const yaml = stringify(data).replace(/\n/g, eol).trimEnd();
  if (!yaml) return body.replace(/^(?:\r?\n)/, "");
  return `---${eol}${yaml}${eol}---${eol}${eol}${body.replace(/^(?:\r?\n)/, "")}`;
}

export function addMarkdownAlias(markdown: string, alias: string): string {
  return writeMarkdownAliases(markdown, [...parseMarkdownAliases(markdown), alias]);
}

export function removeMarkdownAlias(markdown: string, alias: string): string {
  return writeMarkdownAliases(markdown, parseMarkdownAliases(markdown).filter((item) => item !== alias));
}
