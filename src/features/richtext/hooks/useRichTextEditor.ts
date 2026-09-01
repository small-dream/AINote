import { useEditor } from "@tiptap/react";
import { parseRichTextContent } from "../utils/richText";
import { createRichTextExtensions } from "../utils/extensions";
import { useRichTextAssets } from "./useRichTextAssets";
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: createRichTextExtensions(repoPath),
    content: parseRichTextContent(content),
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
  });
  const { handleFiles, status, showStatus } = useRichTextAssets(editor);

  const exportMarkdown = () => {
    if (!editor) return;
    const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
    const markdown = storage.markdown.getMarkdown();
    void navigator.clipboard.writeText(markdown).then(() => showStatus(t("richtext.markdownCopied")));
  };

  const importMarkdown = async () => {
    if (!editor) return;
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text.trim()) {
      editor.commands.setContent(text);
      showStatus(t("richtext.markdownImported"));
    }
  };

  return { editor, handleFiles, status, exportMarkdown, importMarkdown };
}
