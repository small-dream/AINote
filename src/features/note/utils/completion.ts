import type { EditorState } from "@codemirror/state";
import type { NoteWikiDto } from "@/api/types";

export type CompletionKind = "wiki" | "tag";

export interface CompletionContextInfo {
  kind: CompletionKind;
  query: string;
  from: number;
}

/** 判断光标前是否正在输入 [[双链]] 或 #标签，避免把标题语法当成标签。 */
export function getCompletionContext(state: EditorState, pos = state.selection.main.head): CompletionContextInfo | null {
  const currentLine = state.doc.lineAt(pos);
  const line = currentLine.text.slice(0, pos - currentLine.from);
  const wikiStart = line.lastIndexOf("[[");
  if (wikiStart >= 0 && !line.slice(wikiStart + 2).includes("]")) {
    const query = line.slice(wikiStart + 2);
    return { kind: "wiki", query, from: pos - query.length };
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
    ? notes.map((note) => ({ label: note.title, detail: note.path, type: "text", apply: `${note.title}]]` }))
    : [...new Set(notes.flatMap((note) => note.tags))].map((tag) => ({ label: tag, type: "text" }));
  const query = context.query.toLocaleLowerCase();
  return values.filter((item) => item.label.toLocaleLowerCase().includes(query));
}
