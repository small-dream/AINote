import { useCallback, useState, type MouseEvent, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { selectAll } from "@codemirror/commands";
import { dispatchFormat, dispatchLink } from "../hooks/useFormatCommands";
import { toggleInline } from "../utils/format";

interface MarkdownContextMenuOptions {
  viewRef: RefObject<EditorView | null>;
  onOpenAi: () => void;
}

/** Markdown 编辑器右键菜单状态：只保存点击位置，不把 CodeMirror 选区镜像进 React */
export function useMarkdownContextMenu({ viewRef, onOpenAi }: MarkdownContextMenuOptions) {
  const [state, setState] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  const close = useCallback(() => setState(null), []);
  const openAt = useCallback((point: { x: number; y: number }) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    setState({ x: point.x, y: point.y, hasSelection: from !== to });
  }, [viewRef]);
  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    const view = viewRef.current;
    if (!view) return;
    event.preventDefault();
    const { from, to } = view.state.selection.main;
    setState({ x: event.clientX, y: event.clientY, hasSelection: from !== to });
  }, [viewRef]);

  const runInline = useCallback((format: Parameters<typeof toggleInline>[1]) => {
    const view = viewRef.current;
    if (!view) return;
    dispatchFormat(view, (state) => toggleInline(state, format));
    view.focus();
    close();
  }, [close, viewRef]);

  const runClipboard = useCallback((command: "cut" | "copy") => {
    const view = viewRef.current;
    if (!view) return;
    view.focus();
    document.execCommand(command);
    close();
  }, [close, viewRef]);

  const runSelectAll = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    selectAll(view);
    view.focus();
    close();
  }, [close, viewRef]);

  const runLink = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    close();
    void dispatchLink(view).then(() => view.focus());
  }, [close, viewRef]);

  const runPaste = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    close();
    void navigator.clipboard.readText().then((text) => {
      if (!text) return;
      const selection = view.state.selection.main;
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: text }, selection: { anchor: selection.from + text.length } });
      view.focus();
    }).catch(() => undefined);
  }, [close, viewRef]);

  return { position: state, handleContextMenu, openAt, close, runInline, runClipboard, runSelectAll, runLink, runPaste, openAi: () => { close(); onOpenAi(); } };
}
