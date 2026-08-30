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
