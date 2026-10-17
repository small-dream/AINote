import { parse, stringify } from "yaml";

interface MarkdownParts {
  frontmatter: string | null;
  body: string;
}

/** 拆分 Markdown frontmatter 与正文；无 frontmatter 时 frontmatter 为 null。 */
export function splitMarkdownFrontmatter(markdown: string): MarkdownParts {
  if (!markdown.startsWith("---\n")) return { frontmatter: null, body: markdown };
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: null, body: markdown };
  return { frontmatter: markdown.slice(4, end), body: markdown.slice(end + 5) };
}

function frontmatterData(frontmatter: string | null): Record<string, unknown> {
  if (frontmatter === null) return {};
  const parsed = parse(frontmatter);
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/** 从 Markdown frontmatter 读取 aliases（支持字符串数组与单个字符串）。 */
export function parseMarkdownAliases(markdown: string): string[] {
  const value = frontmatterData(splitMarkdownFrontmatter(markdown).frontmatter).aliases;
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 写入标准 aliases frontmatter；空数组时移除该字段，正文保持不变。 */
export function writeMarkdownAliases(markdown: string, aliases: string[]): string {
  const { frontmatter, body } = splitMarkdownFrontmatter(markdown);
  const data = frontmatterData(frontmatter);
  const normalized = [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
  if (normalized.length > 0) data.aliases = normalized;
  else delete data.aliases;
  const yaml = stringify(data).trimEnd();
  if (!yaml) return body.replace(/^\n/, "");
  return `---\n${yaml}\n---\n\n${body.replace(/^\n/, "")}`;
}

export function addMarkdownAlias(markdown: string, alias: string): string {
  return writeMarkdownAliases(markdown, [...parseMarkdownAliases(markdown), alias]);
}

export function removeMarkdownAlias(markdown: string, alias: string): string {
  return writeMarkdownAliases(markdown, parseMarkdownAliases(markdown).filter((item) => item !== alias));
}
