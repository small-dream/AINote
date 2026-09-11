import { useEditor } from "@tiptap/react";
import { useEffect, useMemo } from "react";
import { parseRichTextContent } from "../utils/richText";
import { createRichTextExtensions } from "../utils/extensions";
import { AinoteLink } from "../extensions/link";
import { useRichTextAssets } from "./useRichTextAssets";

interface UseRichTextEditorOptions {
  /** TipTap JSON 字符串（.ainote 文件内容） */
  content: string;
  /** 编辑器变更时输出序列化后的 TipTap JSON 字符串 */
  onChange: (value: string) => void;
  /** 活动仓库绝对路径：用于把图片仓库相对路径解析为本地 URL */
  repoPath: string | null;
}

/** 富文本编辑器核心逻辑：TipTap 实例、资源插入与 Markdown 互转 */
export function useRichTextEditor({ content, onChange, repoPath }: UseRichTextEditorOptions) {
  const editor = useEditor({
    extensions: useMemo(() => [...createRichTextExtensions(repoPath), AinoteLink], [repoPath]),
    content: parseRichTextContent(content),
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
  });
  useEffect(() => {
    if (!editor) return;
    const nextContent = parseRichTextContent(content);
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(nextContent)) return;
    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [content, editor]);
  const { handleFiles, status } = useRichTextAssets(editor);

  return { editor, handleFiles, status };
}
