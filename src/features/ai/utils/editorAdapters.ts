import type { EditorView } from "@codemirror/view";
import type { Editor } from "@tiptap/react";
import type { AiSelection } from "../hooks/useAiWrite";

const CONTINUE_CONTEXT_CHARS = 400;

/** 读取 Markdown 编辑器选区：有选中取选中文本，否则取光标前 400 字符作续写上下文 */
export function getMarkdownSelection(view: EditorView | null, contextTitle?: string): AiSelection {
  if (!view) return { text: "", hasSelection: false, contextTitle };
  const { from, to } = view.state.selection.main;
  const hasSelection = from !== to;
  const text = hasSelection
    ? view.state.sliceDoc(from, to)
    : view.state.sliceDoc(Math.max(0, from - CONTINUE_CONTEXT_CHARS), from);
  return { text, hasSelection, contextTitle };
}

/** 把 AI 结果写入 Markdown 编辑器：有选区则替换，否则在光标处插入并聚焦 */
export function applyToMarkdownEditor(view: EditorView | null, text: string): void {
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const insert = to > from ? text : `\n\n${text}\n\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
  });
  view.focus();
}

/** 读取富文本（TipTap）选区：语义同上 */
export function getTipTapSelection(editor: Editor | null, contextTitle?: string): AiSelection {
  if (!editor) return { text: "", hasSelection: false, contextTitle };
  const { from, to } = editor.state.selection;
  const hasSelection = from !== to;
  const text = hasSelection
    ? editor.state.doc.textBetween(from, to, "\n")
    : editor.state.doc.textBetween(Math.max(1, from - CONTINUE_CONTEXT_CHARS), from, "\n");
  return { text, hasSelection, contextTitle };
}

/** 把 AI 结果写入富文本编辑器：有选区则替换，否则在光标处插入 */
export function applyToTipTapEditor(editor: Editor | null, text: string): void {
  if (!editor) return;
  const { from, to } = editor.state.selection;
  editor.chain().focus().insertContentAt({ from, to }, text).run();
}
