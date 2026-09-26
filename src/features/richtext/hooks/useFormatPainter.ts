import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { applyFormat, captureFormat, type CopiedFormat } from "../utils/formatPainter";

/** 拖拽选择会连续触发 selectionUpdate：稍作等待，避免只把格式刷到拖拽途中的第一个字符。 */
export const FORMAT_PAINTER_DELAY_MS = 250;

export interface FormatPainter {
  /** 已复制格式、等待目标选区 */
  armed: boolean;
  /** 单击复制当前格式并进入待刷态；待刷态再次单击取消 */
  toggle: () => void;
}

/** 格式刷：复制光标 / 选区的格式，下一次非空选区自动套用后退出（复制到「无格式」即刷回正文）。 */
export function useFormatPainter(editor: Editor | null): FormatPainter {
  const formatRef = useRef<CopiedFormat | null>(null);
  const [armed, setArmed] = useState(false);

  const toggle = useCallback(() => {
    if (!editor) return;
    if (formatRef.current) {
      formatRef.current = null;
      setArmed(false);
      return;
    }
    formatRef.current = captureFormat(editor.state);
    setArmed(true);
  }, [editor]);

  useEffect(() => {
    if (!editor || !armed) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSelectionUpdate = (): void => {
      if (!formatRef.current || editor.state.selection.empty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const format = formatRef.current;
        if (!format) return;
        formatRef.current = null;
        setArmed(false);
        applyFormat(editor, format);
      }, FORMAT_PAINTER_DELAY_MS);
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [armed, editor]);

  return { armed, toggle };
}
