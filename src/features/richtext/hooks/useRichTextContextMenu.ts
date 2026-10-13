import { useCallback, useState, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import { usesNativeTextContextMenu } from "@/platform/text-context-menu";

interface ContextMenuState {
  x: number;
  y: number;
  hasSelection: boolean;
}

/** 富文本右键菜单位置：在打开瞬间读取选区，避免让选区进入 React 常规状态 */
export function useRichTextContextMenu() {
  const [state, setState] = useState<ContextMenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>, editor: Editor | null) => {
    if (usesNativeTextContextMenu(event.nativeEvent)) {
      close();
      return;
    }
    if (!editor) return;
    event.preventDefault();
    const { from, to } = editor.state.selection;
    setState({ x: event.clientX, y: event.clientY, hasSelection: from !== to });
  }, [close]);
  return { position: state ? { x: state.x, y: state.y } : null, hasSelection: state?.hasSelection ?? false, handleContextMenu, close };
}
