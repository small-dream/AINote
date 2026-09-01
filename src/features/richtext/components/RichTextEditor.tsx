import type { MouseEvent } from "react";
import { EditorContent } from "@tiptap/react";
import { RichTextToolbar } from "./RichTextToolbar";
import { RichTextBubbleMenu } from "./RichTextBubbleMenu";
import { useRichTextEditor } from "../hooks/useRichTextEditor";
import { useUiStore } from "@/stores/ui.store";
import { swapNoteExtension } from "@/features/note/utils/noteKind";

interface RichTextEditorProps {
  /** TipTap JSON 字符串（.ainote 文件内容） */
  content: string;
  /** 编辑器变更时输出序列化后的 TipTap JSON 字符串 */
  onChange: (value: string) => void;
  /** 活动仓库绝对路径：用于把图片仓库相对路径解析为本地 URL */
  repoPath: string | null;
  /** 点击 `[[双链]]` 时回调目标名（与 Markdown 预览一致） */
  onOpenWiki?: (name: string) => void;
  /** 当前笔记仓库相对路径（用于计算转换目标路径） */
  notePath: string;
  /** 请求把当前富文本转换为 Markdown；to 为目标路径，content 为已转换的 Markdown */
  onConvert?: (to: string, content: string) => void;
}

/** 真富文本所见即所得编辑器：TipTap 读写 TipTap JSON。
 * 支持图片/表格/任务列表、斜杠命令、双链与标签 mark、Markdown 互转导出。
 * 通过父组件 key 重挂载以切换/重载笔记，content 仅在首次创建时解析。 */
export function RichTextEditor({ content, onChange, repoPath, onOpenWiki, notePath, onConvert }: RichTextEditorProps) {
  const { editor, handleFiles, status, exportMarkdown, importMarkdown } = useRichTextEditor({ content, onChange, repoPath });
  const openTagIndex = useUiStore((s) => s.openTagIndex);

  const handleConvertToMarkdown = () => {
    if (!editor) return;
    const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
    const markdown = storage.markdown.getMarkdown();
    onConvert?.(swapNoteExtension(notePath, "markdown"), markdown);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    const wikiElement = element.closest("[data-wiki-target]");
    const target = wikiElement?.getAttribute("data-wiki-target");
    if (target) {
      onOpenWiki?.(target);
      return;
    }
    const tagElement = element.closest("[data-tag]");
    const tag = tagElement?.getAttribute("data-tag");
    if (tag) openTagIndex(tag);
  };

  return (
    <div className="rich-text-editor flex h-full min-h-0 flex-col" onClick={handleClick}>
      <RichTextToolbar editor={editor} onImagePicked={handleFiles} status={status} onExportMarkdown={exportMarkdown} onImportMarkdown={importMarkdown} onConvertToMarkdown={handleConvertToMarkdown} />
      <RichTextBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="rich-text-scroll min-h-0 flex-1 overflow-y-auto px-8 py-4" />
    </div>
  );
}
