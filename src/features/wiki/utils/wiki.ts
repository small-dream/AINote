import type { NoteWikiDto } from "@/api/types";

/** 双链渲染使用的私有协议（配合 urlTransform 保留，预览层拦截点击） */
export const WIKI_PROTOCOL = "wiki:";

/** 标签云条目 */
export interface TagCloudItem {
  name: string;
  count: number;
}

/** 取笔记显示名：文件名去 .md（忽略目录），双链匹配基准 */
export function wikiNameOf(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return base.replace(/\.md$/i, "");
}

/** 聚合仓库标签云：按计数降序、名称升序 */
export function buildTagCloud(notes: NoteWikiDto[]): TagCloudItem[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 按双链名称解析目标笔记路径（忽略大小写）：先按标题、再按文件名（不含 .md）匹配 */
export function resolveWikiTarget(notes: NoteWikiDto[], name: string): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    notes.find((n) => n.title.toLowerCase() === needle)?.path ??
    notes.find((n) => wikiNameOf(n.path).toLowerCase() === needle)?.path ??
    null
  );
}

/** 反向链接：指向 targetPath 的笔记（按双链解析结果判定，排除自身） */
export function findBacklinks(notes: NoteWikiDto[], targetPath: string): NoteWikiDto[] {
  return notes.filter(
    (note) => note.path !== targetPath &&
      note.links.some((link) => resolveWikiTarget(notes, link) === targetPath)
  );
}

/** 取笔记标题（找不到回退文件名） */
export function noteTitle(notes: NoteWikiDto[], path: string): string {
  return notes.find((n) => n.path === path)?.title ?? wikiNameOf(path);
}

/** 当前笔记的标签 */
export function tagsOf(notes: NoteWikiDto[], path: string): string[] {
  return notes.find((n) => n.path === path)?.tags ?? [];
}

/** 把 `[[目标|显示]]` 双链转为可渲染的 markdown 链接（href 走 wiki: 协议 + encode） */
export function transformWikiLinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, alias?: string) => {
      const name = target.trim();
      const label = (alias ?? target).trim() || name;
      return `[${label}](${WIKI_PROTOCOL}${encodeURIComponent(name)})`;
    }
  );
}

/** 解析 wiki: 协议 href 为原始目标名（decode 失败回退原文） */
export function decodeWikiHref(href: string): string {
  const raw = href.slice(WIKI_PROTOCOL.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
