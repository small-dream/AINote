import { parse, stringify } from "yaml";

interface FrontmatterParts {
  frontmatter: string | null;
  body: string;
}

/** 拆分 Markdown 的 frontmatter 与正文；无 frontmatter 时 frontmatter 为 null。 */
export function splitFrontmatter(markdown: string): FrontmatterParts {
  if (!markdown.startsWith("---\n")) return { frontmatter: null, body: markdown };
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: null, body: markdown };
  return { frontmatter: markdown.slice(4, end), body: markdown.slice(end + 5) };
}

/** 更新（或新增）frontmatter 的 summary 字段，返回新 Markdown（正文保留）。 */
export function upsertFrontmatterSummary(markdown: string, summary: string): string {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const parsed = frontmatter === null ? {} : parse(frontmatter);
  const data =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  data.summary = summary.trim();
  const yamlStr = stringify(data).trimEnd();
  const bodyText = body.replace(/^\n/, "");
  return `---\n${yamlStr}\n---\n\n${bodyText}`;
}
