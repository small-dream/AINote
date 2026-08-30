import { useCallback, useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";
import { findTitleCursorIndex } from "../utils/markdown";

/** 新建笔记后自动聚焦首行标题（P2）：对同一条 notePath 只聚焦一次 */
export function useFocusTitleOnLoad(active: boolean, notePath: string | null, content: string) {
  const viewRef = useRef<EditorView | null>(null);
  const didFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !notePath || didFocus.current === notePath) return;
    const view = viewRef.current;
    if (!view) return;
    didFocus.current = notePath;
    view.dispatch({ selection: { anchor: findTitleCursorIndex(content) }, scrollIntoView: true });
    view.focus();
  }, [active, notePath, content]);

  const onCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  return { onCreateEditor, viewRef };
}
