import type { EditorSelectionRange } from "./editorSelection";

/**
 * 选区快照按「仓库 + 笔记」缓存。
 *
 * 写作 / 源码 / 分栏 / 预览之间切换会重建 CodeMirror，新实例默认把光标放回文档开头；
 * 光标是编辑器瞬态，放 React 状态会带来额外渲染，这里用模块级存储跨实例传递。
 */
const selections = new Map<string, EditorSelectionRange>();

export function editorSelectionKey(repoPath: string | null, notePath: string | null): string | null {
  return notePath ? `${repoPath ?? ""}\u0000${notePath}` : null;
}

export function rememberEditorSelection(key: string | null, selection: EditorSelectionRange): void {
  if (!key) return;
  selections.set(key, { anchor: selection.anchor, head: selection.head });
}

export function readEditorSelection(key: string | null): EditorSelectionRange | null {
  if (!key) return null;
  return selections.get(key) ?? null;
}

/** 单测清理：避免用例之间互相串光标。 */
export function clearEditorSelectionMemory(): void {
  selections.clear();
}
