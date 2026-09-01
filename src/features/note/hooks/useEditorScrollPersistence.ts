import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import type { ViewMode } from "../components/EditorToolbar";
import { attachEditorScrollPersistence } from "../utils/editorScrollPersistence";

interface ScrollPersistenceOptions {
  editorScrollTop: number;
  previewScrollTop: number;
  setEditorScrollTop: (value: number) => void;
  setPreviewScrollTop: (value: number) => void;
}

/** 绑定编辑器/预览滚动位置持久化；只在 view 或模式切换时重绑监听器。 */
export function useEditorScrollPersistence(
  view: EditorView | null,
  previewRef: RefObject<HTMLDivElement | null>,
  mode: ViewMode,
  options: ScrollPersistenceOptions,
): void {
  const { editorScrollTop, previewScrollTop, setEditorScrollTop, setPreviewScrollTop } = options;
  const scrollPreferences = useMemo(() => ({ editorScrollTop, previewScrollTop }), [editorScrollTop, previewScrollTop]);

  useEffect(() => {
    if (!view) return;
    return attachEditorScrollPersistence(view, previewRef.current, scrollPreferences, setEditorScrollTop, setPreviewScrollTop);
  }, [mode, previewRef, scrollPreferences, setEditorScrollTop, setPreviewScrollTop, view]);
}
