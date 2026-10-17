import type { NoteWikiDto, WikiHeading } from "@/api/types";

/** 双链渲染使用的私有协议（配合 urlTransform 保留，预览层拦截点击） */
export const WIKI_PROTOCOL = "wiki:";

/** 标签云条目 */
export interface TagCloudItem {
  name: string;
  count: number;
}

/** 标签下的一条笔记，附带目录树元数据里的更新时间。 */
export interface TagNote {
  note: NoteWikiDto;
  updatedAt: number;
}

/** 双链目标：笔记名 + 可选标题。 */
export interface WikiTarget {
  name: string;
  heading: string | null;
}

/** 解析 `[[笔记#标题|显示文本]]` 中的目标部分。 */
export function parseWikiTarget(raw: string): WikiTarget {
  const target = raw.split("|", 1)[0]?.trim() ?? "";
  const hash = target.indexOf("#");
  return {
    name: (hash < 0 ? target : target.slice(0, hash)).trim(),
    heading: hash < 0 ? null : target.slice(hash + 1).trim() || null,
  };
}

/** 取笔记显示名：文件名去笔记扩展名（忽略目录），双链匹配基准 */
export function wikiNameOf(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return base.replace(/\.(md|ainote)$/i, "");
}

/** 标题匹配：忽略行内 Markdown、大小写与首尾空白。 */
export function normalizeWikiHeading(value: string): string {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~[\]]/g, "")
    .trim()
    .toLocaleLowerCase();
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

/** 过滤标签名；输入仅做大小写不敏感的包含匹配。 */
export function filterTagCloud(tags: TagCloudItem[], query: string): TagCloudItem[] {
  const needle = query.trim().toLocaleLowerCase();
  return needle ? tags.filter((tag) => tag.name.includes(needle)) : tags;
}

/** 聚合指定标签下的笔记，并按更新时间倒序展示。 */
export function buildTagNotes(
  notes: NoteWikiDto[],
  tag: string,
  updatedAtByPath: ReadonlyMap<string, number> = new Map(),
): TagNote[] {
  return notes
    .filter((note) => note.tags.includes(tag))
    .map((note) => ({ note, updatedAt: updatedAtByPath.get(note.path) ?? 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.note.path.localeCompare(b.note.path));
}

/** 按双链名称解析目标笔记路径（忽略大小写）：标题 → 别名 → 文件名。 */
export function resolveWikiTarget(notes: NoteWikiDto[], raw: string): string | null {
  const needle = parseWikiTarget(raw).name.toLocaleLowerCase();
  if (!needle) return null;
  return (
    notes.find((note) => note.title.toLocaleLowerCase() === needle)?.path ??
    notes.find((note) => (note.aliases ?? []).some((alias) => alias.toLocaleLowerCase() === needle))?.path ??
    notes.find((note) => wikiNameOf(note.path).toLocaleLowerCase() === needle)?.path ??
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

/** 双链名称索引：title / alias / 文件名（不含 .md）小写 → 路径，先出现者优先。 */
export interface WikiNameIndex {
  byTitle: ReadonlyMap<string, string>;
  byAlias: ReadonlyMap<string, string>;
  byFileName: ReadonlyMap<string, string>;
}

/** 预建名称索引（O(n)），供面板等高频解析场景复用。 */
export function buildWikiNameIndex(notes: NoteWikiDto[]): WikiNameIndex {
  const byTitle = new Map<string, string>();
  const byAlias = new Map<string, string>();
  const byFileName = new Map<string, string>();
  for (const note of notes) {
    const titleKey = note.title.toLocaleLowerCase();
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, note.path);
    for (const alias of note.aliases ?? []) {
      const aliasKey = alias.toLocaleLowerCase();
      if (!byAlias.has(aliasKey)) byAlias.set(aliasKey, note.path);
    }
    const nameKey = wikiNameOf(note.path).toLocaleLowerCase();
    if (!byFileName.has(nameKey)) byFileName.set(nameKey, note.path);
  }
  return { byTitle, byAlias, byFileName };
}

/** resolveWikiTarget 的索引版本：标题 → 别名 → 文件名。 */
export function resolveWikiTargetByIndex(index: WikiNameIndex, raw: string): string | null {
  const needle = parseWikiTarget(raw).name.toLocaleLowerCase();
  if (!needle) return null;
  return index.byTitle.get(needle) ?? index.byAlias.get(needle) ?? index.byFileName.get(needle) ?? null;
}

/** findBacklinks 的索引版本。 */
export function findBacklinksByIndex(notes: NoteWikiDto[], index: WikiNameIndex, targetPath: string): NoteWikiDto[] {
  return notes.filter(
    (note) => note.path !== targetPath &&
      note.links.some((link) => resolveWikiTargetByIndex(index, link) === targetPath)
  );
}

/** 取目标笔记的标题索引；找不到笔记时返回空数组。 */
export function wikiHeadingsOf(notes: NoteWikiDto[], raw: string): WikiHeading[] {
  const path = resolveWikiTarget(notes, raw);
  return notes.find((note) => note.path === path)?.headings ?? [];
}

/** 在标题索引中查找标题（忽略行内 Markdown、大小写与首尾空白）。 */
export function findWikiHeading(notes: NoteWikiDto[], raw: string): WikiHeading | null {
  const { heading } = parseWikiTarget(raw);
  if (!heading) return null;
  const needle = normalizeWikiHeading(heading);
  return wikiHeadingsOf(notes, raw).find((item) => normalizeWikiHeading(item.text) === needle) ?? null;
}

/** backlinkContextsOf 的索引版本。 */
export function backlinkContextsByIndex(note: NoteWikiDto, index: WikiNameIndex, targetPath: string): BacklinkContext[] {
  return (note.linkContexts ?? [])
    .filter((context) => resolveWikiTargetByIndex(index, context.target) === targetPath)
    .map(({ line, snippet, heading }) => ({ line, snippet, heading: heading ?? null }));
}

/** 标签输入建议：全仓库已有标签去掉当前笔记已有的，按名称升序。 */
export function buildTagSuggestions(notes: NoteWikiDto[], currentTags: string[]): string[] {
  return [...new Set(notes.flatMap((note) => note.tags))]
    .filter((tag) => !currentTags.includes(tag))
    .sort((a, b) => a.localeCompare(b));
}

/** 取笔记标题（找不到回退文件名） */
export function noteTitle(notes: NoteWikiDto[], path: string): string {
  return notes.find((n) => n.path === path)?.title ?? wikiNameOf(path);
}

/** 当前笔记的标签 */
export function tagsOf(notes: NoteWikiDto[], path: string): string[] {
  return notes.find((n) => n.path === path)?.tags ?? [];
}

/** 把 `[[目标|显示]]` 双链转为可渲染的 markdown 链接（href 走 wiki: 协议 + encode）。 */
export function transformWikiLinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, alias?: string) => {
      const parsed = parseWikiTarget(target);
      const label = (alias ?? parsed.name).trim() || parsed.name;
      const hrefTarget = parsed.heading ? `${parsed.name}#${parsed.heading}` : parsed.name;
      return `[${label}](${WIKI_PROTOCOL}${encodeURIComponent(hrefTarget)})`;
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

/** 反向链接的上下文片段（已按目标解析过滤、带行号）。 */
export interface BacklinkContext {
  line: number;
  snippet: string;
  heading?: string | null;
}

/** 取一篇笔记中所有解析到 targetPath 的双链上下文（支持同一目标多处提及）。 */
export function backlinkContextsOf(note: NoteWikiDto, notes: NoteWikiDto[], targetPath: string): BacklinkContext[] {
  return (note.linkContexts ?? [])
    .filter((context) => resolveWikiTarget(notes, context.target) === targetPath)
    .map(({ line, snippet, heading }) => ({ line, snippet, heading: heading ?? null }));
}

const WINDOWS_RESERVED = /[<>:"|?*]/g;

/** 由双链目标名生成可创建的仓库相对笔记路径（.md，非法字符转 `-`，保留目录）。 */
export function wikiCreatePath(rawName: string): string {
  const segments = parseWikiTarget(rawName).name
    .trim()
    .split("/")
    .map((segment) => segment.replace(WINDOWS_RESERVED, "-").replace(/^[.\s]+|[.\s]+$/g, ""))
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return "untitled.md";
  const base = segments.at(-1) as string;
  segments[segments.length - 1] = base.toLocaleLowerCase().endsWith(".md") ? base : `${base}.md`;
  return segments.join("/");
}
