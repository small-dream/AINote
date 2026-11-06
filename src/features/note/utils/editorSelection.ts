import type { EditorView } from "@codemirror/view";
import { readEditorSelection } from "./editorSelectionStore";

export interface EditorSelectionRange {
  anchor: number;
  head: number;
}

/** 把快照夹到当前文档范围内：重建期间文档可能被改写、变短或清空。 */
export function clampEditorSelection(snapshot: EditorSelectionRange, docLength: number): EditorSelectionRange {
  const max = Math.max(0, docLength);
  return {
    anchor: Math.min(Math.max(snapshot.anchor, 0), max),
    head: Math.min(Math.max(snapshot.head, 0), max),
  };
}

/** 把同一篇笔记上一次的选区还给新实例；返回是否真的改动了选区。 */
export function restoreEditorSelection(view: EditorView, key: string | null): boolean {
  const snapshot = readEditorSelection(key);
  if (!snapshot) return false;
  const next = clampEditorSelection(snapshot, view.state.doc.length);
  const current = view.state.selection.main;
  if (current.anchor === next.anchor && current.head === next.head) return false;
  view.dispatch({ selection: next });
  return true;
}

/**
 * 新建的 CodeMirror 实例不会补发 updateListener；显式派发一次「原样选区」事务，
 * 让依赖 updateListener 的工具栏按新光标重算格式，避免沿用上一个视图的 H1 高亮。
 */
export function notifyEditorReady(view: EditorView): void {
  view.dispatch({ selection: view.state.selection.main });
}
