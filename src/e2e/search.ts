import type { SearchResult } from "@/api/types";
import { isEnvelopeText } from "./envelope";
import { metaOf, type NoteStore } from "./notes";

const MAX_RESULTS = 30;
const SNIPPET_MAX_CHARS = 80;

/** E2E 搜索 mock：与 Rust 搜索同口径，覆盖标题、路径与正文的首个命中。 */
export function searchNotes(store: NoteStore, query: string): SearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const results = [...store.notes.entries()].flatMap(([path, note]) => {
    if (isEnvelopeText(note.content)) return [];
    const meta = metaOf(path, note);
    const content = searchableText(note);
    const contentIndex = content.toLocaleLowerCase().indexOf(needle);
    const metadataHit = path.toLocaleLowerCase().includes(needle) || meta.title.toLocaleLowerCase().includes(needle);
    if (contentIndex < 0 && !metadataHit) return [];
    const line = contentIndex < 0 ? 1 : content.slice(0, contentIndex).split("\n").length;
    const snippet = contentIndex < 0 ? meta.title : lineSnippet(content, line);
    return [{ path, title: meta.title, snippet, line, updatedAt: meta.updatedAt, encrypted: meta.encrypted }];
  });
  results.sort((a, b) => Number(b.title.toLocaleLowerCase().includes(needle)) - Number(a.title.toLocaleLowerCase().includes(needle)) || a.path.localeCompare(b.path));
  return results.slice(0, MAX_RESULTS);
}

function searchableText(note: { content: string; kind: string }): string {
  if (note.kind !== "richText") return note.content;
  try {
    return collectText(JSON.parse(note.content) as unknown);
  } catch {
    return note.content;
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join("\n");
  const record = value as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === "text" && typeof record.text === "string") return record.text;
  return collectText(record.content);
}

function lineSnippet(content: string, line: number): string {
  const text = (content.split("\n")[line - 1] ?? "").trim();
  return text.length <= SNIPPET_MAX_CHARS ? text : `${text.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}
