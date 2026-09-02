/** 标题建议的解析与落笔纯函数（P1-AI-3） */

/** 清洗单行候选：去首尾空白、行首序号（1. / 1、 / - / *）、包裹引号。 */
export function cleanTitleCandidate(line: string): string {
  let text = line.trim();
  text = text.replace(/^\d+\s*[.、)）．:]\s*/, "");
  text = text.replace(/^[-*]\s+/, "");
  text = text.replace(/^[「“"']+|[」”"']+$/g, "");
  return text.trim();
}

/** 解析 LLM 输出的标题候选（每行一个），清洗后去空去重，最多 6 条。 */
export function parseTitleSuggestions(text: string): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const raw of text.split("\n")) {
    const title = cleanTitleCandidate(raw);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
    if (titles.length >= 6) break;
  }
  return titles;
}

/** 应用标题：替换首个 ATX 一级标题行；无标题则在文首插入 `# 标题`。 */
export function applyTitleToMarkdown(markdown: string, title: string): string {
  const clean = title.trim();
  const lines = markdown.split("\n");
  const index = lines.findIndex((line) => line.startsWith("# "));
  if (index !== -1) {
    lines[index] = `# ${clean}`;
    return lines.join("\n");
  }
  return `# ${clean}\n\n${markdown}`;
}
