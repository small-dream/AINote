import { useCallback, useState, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";

interface ContextMenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

/** 富文本右键菜单位置：在打开瞬间读取选区，避免让选区进入 React 常规状态 */
export function useRichTextContextMenu() {
  const [state, setState] = useState<ContextMenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const openAt = useCallback((point: { x: number; y: number }, editor: Editor | null) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setState({ x: point.x, y: point.y, hasSelection: from !== to });
  }, []);
  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>, editor: Editor | null) => {
    if (!editor) return;
    event.preventDefault();
    const { from, to } = editor.state.selection;
    setState({ x: event.clientX, y: event.clientY, hasSelection: from !== to });
  }, []);
  return { position: state ? { x: state.x, y: state.y } : null, hasSelection: state?.hasSelection ?? false, handleContextMenu, openAt, close };
}
