/** 从 Markdown 源码中提取标题：取第一个 ATX 标题，否则回退到文件名 */
export function extractTitle(markdown: string, fallback: string): string {
  for (const line of markdown.split("\n")) {
    const match = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

/** 提取 [[wiki-link]] 双链（P1-5 预留） */
export function extractWikiLinks(markdown: string): string[] {
  const links: string[] = [];
  for (const match of markdown.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    if (match[1]) links.push(match[1].trim());
  }
  return links;
}

/** 返回「光标定位到首行标题文字处」的插入点：首行是 `# xxx` 时返回 2，否则返回 0 */
export function findTitleCursorIndex(markdown: string): number {
  const lineEnd = markdown.indexOf("\n");
  const firstLine = lineEnd === -1 ? markdown : markdown.slice(0, lineEnd);
  return firstLine.startsWith("# ") ? 2 : 0;
}

/** 仅用输入值替换首个一级标题；没有一级标题时插入 `# 标题`。 */
export function applyMarkdownTitle(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const index = lines.findIndex((line) => line.startsWith("# "));
  if (index !== -1) {
    lines[index] = `# ${title}`;
    return lines.join("\n");
  }
  return title ? `# ${title}\n\n${markdown}` : markdown;
}
