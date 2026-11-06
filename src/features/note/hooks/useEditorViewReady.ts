import { useCallback, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { notifyEditorReady, restoreEditorSelection } from "../utils/editorSelection";

/**
 * 跟踪 CodeMirror view 实例的就绪状态。
 * @uiw/react-codemirror 需二次渲染才创建 view，挂载后逻辑须以该状态为依赖；
 * 模式切换会重挂载 CodeMirror 并创建新 view，因此返回实例本身而非布尔值，
 * 保证依赖它的 effect 在换实例后重新执行。
 *
 * selectionKey 用于把同一篇笔记上一次的光标还给新实例；没有可还原的选区时也补发一次
 * 事务，让工具栏按新光标重算格式，避免沿用上一个视图的 H1 高亮。
 */
export function useEditorViewReady(onCreateEditor: (view: EditorView) => void, selectionKey: string | null = null) {
  const [readyView, setReadyView] = useState<EditorView | null>(null);
  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      onCreateEditor(view);
      if (!restoreEditorSelection(view, selectionKey)) notifyEditorReady(view);
      setReadyView(view);
    },
    [onCreateEditor, selectionKey]
  );
  return { readyView, handleCreateEditor };
}
