import { useCallback, useState } from "react";
import type { EditorView } from "@codemirror/view";

/**
 * 跟踪 CodeMirror view 实例的就绪状态。
 * @uiw/react-codemirror 需二次渲染才创建 view，挂载后逻辑须以该状态为依赖；
 * 模式切换会重挂载 CodeMirror 并创建新 view，因此返回实例本身而非布尔值，
 * 保证依赖它的 effect 在换实例后重新执行。
 */
export function useEditorViewReady(onCreateEditor: (view: EditorView) => void) {
  const [readyView, setReadyView] = useState<EditorView | null>(null);
  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      onCreateEditor(view);
      setReadyView(view);
    },
    [onCreateEditor]
  );
  return { readyView, handleCreateEditor };
}
