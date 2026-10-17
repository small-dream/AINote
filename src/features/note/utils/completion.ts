import type { EditorState } from "@codemirror/state";
import type { NoteWikiDto } from "@/api/types";

export type CompletionKind = "wiki" | "tag";

export interface CompletionContextInfo {
  kind: CompletionKind;
  query: string;
  from: number;
  /** `[[笔记#` 场景下的目标笔记名；普通双链为空。 */
  wikiNote?: string;
}

/** 判断光标前是否正在输入 [[双链]] 或 #标签，避免把标题语法当成标签。 */
export function getCompletionContext(state: EditorState, pos = state.selection.main.head): CompletionContextInfo | null {
  const currentLine = state.doc.lineAt(pos);
  const line = currentLine.text.slice(0, pos - currentLine.from);
  const wikiStart = line.lastIndexOf("[[");
  if (wikiStart >= 0 && !line.slice(wikiStart + 2).includes("]")) {
    const raw = line.slice(wikiStart + 2);
    const hash = raw.indexOf("#");
    if (hash >= 0) {
      const query = raw.slice(hash + 1);
      return { kind: "wiki", query, from: pos - query.length, wikiNote: raw.slice(0, hash).trim() };
    }
    return { kind: "wiki", query: raw, from: pos - raw.length };
  }
  const tag = /(?:^|\s)#([^\s#]*)$/.exec(line);
  if (tag && !/^#\s/.test(line)) {
    const query = tag[1] ?? "";
    return { kind: "tag", query, from: pos - query.length };
  }
  return null;
}

export function buildCompletions(notes: NoteWikiDto[], context: CompletionContextInfo) {
  const values = context.kind === "wiki"
    ? wikiCompletions(notes, context)
    : [...new Set(notes.flatMap((note) => note.tags))].map((tag) => ({ label: tag, type: "text" }));
  const query = context.query.toLocaleLowerCase();
  return values.filter((item) => item.label.toLocaleLowerCase().includes(query));
}

function wikiCompletions(notes: NoteWikiDto[], context: CompletionContextInfo) {
  if (context.wikiNote !== undefined) {
    const note = findNote(notes, context.wikiNote);
    return (note?.headings ?? []).map((heading) => ({
      label: heading.text,
      detail: note?.path ?? "",
      type: "text",
      apply: `${heading.text}]]`,
    }));
  }
  return notes.map((note) => ({ label: note.title, detail: note.path, type: "text", apply: `${note.title}]]` }));
}

function findNote(notes: NoteWikiDto[], raw: string): NoteWikiDto | undefined {
  const needle = raw.trim().toLocaleLowerCase();
  return notes.find((note) => note.title.toLocaleLowerCase() === needle)
    ?? notes.find((note) => (note.aliases ?? []).some((alias) => alias.toLocaleLowerCase() === needle))
    ?? notes.find((note) => (note.path.split("/").at(-1) ?? "").replace(/\.(md|ainote)$/i, "").toLocaleLowerCase() === needle);
}
