/** E2E mock：双链索引、未链接提及扫描与转换（仅覆盖测试所需语义）。 */
import type { NoteWikiDto, UnlinkedMention, UnlinkedMentionRef, WikiHeading, WikiLinkContext } from "@/api/types";
import { markWorkspaceDirty, type DirtyTrackedStore } from "./dirty";
import { metaOf, type E2eNoteMap } from "./notes";

export interface WikiStore extends DirtyTrackedStore {
  notes: E2eNoteMap;
}

interface WikiContext {
  store: WikiStore;
}

type WikiHandler = (args: Record<string, unknown>, ctx: WikiContext) => unknown;

function wikiError(message: string) {
  return { code: "WIKI_10001", kind: "Conflict", message, retriable: true };
}

function stem(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.(md|ainote)$/i, "");
}

function frontmatter(content: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match?.[1] ?? null;
}

function aliasesOf(content: string, kind: string): string[] {
  if (kind !== "markdown") return [];
  const body = frontmatter(content);
  if (!body) return [];
  const inline = /^aliases:\s*(.+)$/m.exec(body)?.[1]?.trim();
  if (inline) {
    return inline.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  const block = /^aliases:\s*\n((?:\s*-\s*.+\n?)+)/m.exec(body)?.[1] ?? "";
  return block.split("\n").map((line) => line.trim().replace(/^-\s*/, "").replace(/^["']|["']$/g, "")).filter(Boolean);
}

function headingsOf(content: string, kind: string): WikiHeading[] {
  if (kind === "richText") {
    try {
      return richHeadings(JSON.parse(content) as unknown);
    } catch {
      return [];
    }
  }
  const headings: WikiHeading[] = [];
  let inFrontmatter = false;
  let inFence = false;
  content.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (index === 0 && line === "---") { inFrontmatter = true; return; }
    if (inFrontmatter) { if (line === "---") inFrontmatter = false; return; }
    if (line.startsWith("```") || line.startsWith("~~~")) { inFence = !inFence; return; }
    if (inFence) return;
    const matched = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (matched) headings.push({ text: (matched[2] ?? "").replace(/[`*_~[\]]/g, ""), level: matched[1]?.length ?? 1, line: index + 1 });
  });
  return headings;
}

function richHeadings(node: unknown): WikiHeading[] {
  const out: WikiHeading[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const object = value as { type?: string; attrs?: { level?: number }; content?: unknown[]; text?: string };
    if (object.type === "heading") {
      const text = textOf(object.content ?? []);
      if (text) out.push({ text, level: object.attrs?.level ?? 1, line: out.length + 1 });
    }
    for (const child of object.content ?? []) walk(child);
  };
  walk(node);
  return out;
}

function textOf(content: unknown[]): string {
  return content.map((item) => {
    if (!item || typeof item !== "object") return "";
    const node = item as { type?: string; text?: string; content?: unknown[] };
    return node.type === "text" ? node.text ?? "" : textOf(node.content ?? []);
  }).join("");
}

function plainText(content: string, kind: string): string {
  if (kind !== "richText") return content;
  try {
    const collected: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const object = node as { type?: string; text?: string; content?: unknown[] };
      if (object.type === "text" && object.text) collected.push(object.text);
      for (const child of object.content ?? []) walk(child);
    };
    walk(JSON.parse(content) as unknown);
    return collected.join("\n");
  } catch {
    return "";
  }
}

function linksOf(content: string): { links: string[]; linkContexts: WikiLinkContext[] } {
  const links: string[] = [];
  const linkContexts: WikiLinkContext[] = [];
  content.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = (match[1] ?? "").split("|")[0]?.split("#")[0]?.trim() ?? "";
      if (!target) continue;
      if (!links.includes(target)) links.push(target);
      linkContexts.push({ target, line: index + 1, snippet: line.trim() });
    }
  });
  return { links, linkContexts };
}

function noteWiki(path: string, note: { content: string; kind: string }): NoteWikiDto {
  const links = linksOf(plainText(note.content, note.kind));
  return {
    path,
    title: metaOf(path, note).title,
    aliases: aliasesOf(note.content, note.kind),
    tags: [...new Set((plainText(note.content, note.kind).match(/#[\p{L}\p{N}_/-]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase()))],
    headings: headingsOf(note.content, note.kind),
    ...links,
  };
}

function targetInfo(store: WikiStore, path: string) {
  const note = store.notes.get(path);
  if (!note) throw wikiError("目标笔记不存在");
  const title = metaOf(path, note).title;
  const terms = [...new Set([title, stem(path), ...aliasesOf(note.content, note.kind)].filter((term) => term.length >= 2))]
    .sort((left, right) => right.length - left.length);
  return { path, title, terms };
}

function scanMentions(store: WikiStore, targetPath: string): UnlinkedMention[] {
  const target = targetInfo(store, targetPath);
  const found: UnlinkedMention[] = [];
  for (const [sourcePath, note] of store.notes) {
    if (sourcePath === targetPath) continue;
    const lines = plainText(note.content, note.kind).split("\n");
    const counts = new Map<string, number>();
    lines.forEach((line, index) => {
      const visible = line.replace(/\[\[[^\]]+\]\]/g, " ");
      for (const term of target.terms) {
        const matched = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        for (const _match of visible.matchAll(matched)) {
          const key = term.toLowerCase();
          const occurrence = counts.get(key) ?? 0;
          counts.set(key, occurrence + 1);
          found.push({ sourcePath, sourceTitle: metaOf(sourcePath, note).title, term, line: index + 1, snippet: line.trim(), occurrence });
          if (found.length >= 100) return;
        }
      }
    });
    if (found.length >= 100) break;
  }
  return found;
}

function occurrenceIndex(content: string, term: string, occurrence: number): number {
  const hay = content.toLowerCase();
  const needle = term.toLowerCase();
  let from = 0;
  let index = -1;
  for (let count = 0; count <= occurrence; count += 1) {
    index = hay.indexOf(needle, from);
    if (index < 0) return -1;
    from = index + needle.length;
  }
  return index;
}

export const wikiCommandHandlers: Record<string, WikiHandler> = {
  wiki_index: (_args, ctx) => [...ctx.store.notes.entries()].map(([path, note]) => noteWiki(path, note)),
  wiki_unlinked_mentions: (args, ctx) => scanMentions(ctx.store, String(args.path ?? "")),
  wiki_convert_mentions: (args, ctx) => {
    const targetPath = String(args.targetPath ?? "");
    const target = targetInfo(ctx.store, targetPath);
    const refs = Array.isArray(args.mentions) ? args.mentions as UnlinkedMentionRef[] : [];
    const grouped = new Map<string, UnlinkedMentionRef[]>();
    for (const ref of refs) grouped.set(ref.sourcePath, [...(grouped.get(ref.sourcePath) ?? []), ref]);
    const updates = new Map<string, string>();
    let count = 0;
    for (const [sourcePath, items] of grouped) {
      const note = ctx.store.notes.get(sourcePath);
      if (!note) throw wikiError("来源笔记不存在");
      const ranges = new Map<string, { start: number; end: number }>();
      for (const item of items) {
        const start = occurrenceIndex(note.content, item.term, item.occurrence);
        if (start < 0) throw wikiError("未链接提及已变化，请刷新后重试");
        ranges.set(`${start}:${start + item.term.length}`, { start, end: start + item.term.length });
      }
      let next = note.content;
      for (const range of [...ranges.values()].sort((left, right) => right.start - left.start)) {
        next = `${next.slice(0, range.start)}[[${target.title}]]${next.slice(range.end)}`;
      }
      updates.set(sourcePath, next);
      count += ranges.size;
    }
    for (const [path, content] of updates) {
      const note = ctx.store.notes.get(path);
      if (note) note.content = content;
      markWorkspaceDirty(ctx.store, path);
    }
    return count;
  },
};
