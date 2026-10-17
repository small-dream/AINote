import { useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { parseRichTextContent } from "../utils/richText";
import { createRichTextExtensions } from "../utils/extensions";
import { useRichTextAssets } from "./useRichTextAssets";
import { countCharacters, positionAt, type EditorStats } from "@/features/note/utils/editorStats";

interface UseRichTextEditorOptions {
  /** TipTap JSON 字符串（.ainote 文件内容） */
  content: string;
  /** 编辑器变更时输出序列化后的 TipTap JSON 字符串 */
  onChange: (value: string) => void;
  /** 活动仓库绝对路径：用于把图片仓库相对路径解析为本地 URL */
  repoPath: string | null;
  typewriterMode?: boolean;
  onStatsChange?: (stats: EditorStats) => void;
}

/** 富文本编辑器核心逻辑：TipTap 实例、资源插入与 Markdown 互转 */
export function useRichTextEditor({ content, onChange, repoPath, typewriterMode = false, onStatsChange }: UseRichTextEditorOptions) {
  const editor = useEditor({
    extensions: useMemo(() => createRichTextExtensions(repoPath), [repoPath]),
    content: parseRichTextContent(content),
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
  });
  const statsCallback = useRef(onStatsChange);
  useEffect(() => { statsCallback.current = onStatsChange; }, [onStatsChange]);
  useEffect(() => {
    if (!editor || editor.isDestroyed || typeof editor.on !== "function") return undefined;
    let frame = 0;
    const emitStats = () => statsCallback.current?.(richTextStats(editor));
    const onUpdate = () => {
      emitStats();
      if (!typewriterMode) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => centerCaret(editor));
    };
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", emitStats);
    emitStats();
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", emitStats);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [editor, typewriterMode]);
  useEffect(() => {
    // TipTap 的实例销毁是异步的（scheduleDestroy 走 setTimeout）：被销毁的实例仍可能出现在
    // 本轮 effect 闭包里，而其 commandManager 已置空，调用 commands 会抛
    // 「Cannot read properties of null (reading 'commands')」并让整个编辑器白屏。
    if (!editor || editor.isDestroyed) return;
    const nextContent = parseRichTextContent(content);
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(nextContent)) return;
    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [content, editor]);
  const { handleFiles, status } = useRichTextAssets(editor);

  return { editor, handleFiles, status };
}

function richTextStats(editor: Editor): EditorStats {
  const from = editor.state.selection.from;
  const before = editor.state.doc.textBetween(0, from, "\n", "\n");
  return { characters: countCharacters(editor.getText()), ...positionAt(before, before.length) };
}

/** 打字机滚动：把当前光标在富文本滚动容器中保持在垂直中线。 */
function centerCaret(editor: Editor): void {
  if (editor.isDestroyed) return;
  const container = editor.view.dom.closest<HTMLElement>(".rich-text-scroll");
  if (!container) return;
  const coords = editor.view.coordsAtPos(editor.state.selection.from);
  const rect = container.getBoundingClientRect();
  if (!coords || rect.height <= 0) return;
  container.scrollTop = Math.max(0, container.scrollTop + coords.top - rect.top - rect.height / 2);
}
