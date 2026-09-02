import type { MouseEvent } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { RichTextToolbar } from "./RichTextToolbar";
import { RichTextBubbleMenu } from "./RichTextBubbleMenu";
import { useRichTextEditor } from "../hooks/useRichTextEditor";
import { useRichTextOutline } from "../hooks/useRichTextOutline";
import { useUiStore } from "@/stores/ui.store";
import { swapNoteExtension } from "@/features/note/utils/noteKind";
import { NoteOutlineFloating } from "@/features/note/components/NoteOutlineFloating";
import type { OutlineItem } from "@/features/note/utils/outline";
import { useAiWrite } from "@/features/ai/hooks/useAiWrite";
import { AiWriteControls } from "@/features/ai/components/AiWriteControls";
import { AiToolbarButton } from "@/features/ai/components/AiToolbarButton";
import { getTipTapSelection, applyToTipTapEditor } from "@/features/ai/utils/editorAdapters";

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
  /** 是否保持大纲浮层展开 */
  outlineOpen?: boolean;
  onOutlineToggle?: () => void;
}

/** 真富文本所见即所得编辑器：TipTap 读写 TipTap JSON。
 * 支持图片/表格/任务列表、斜杠命令、双链与标签 mark、Markdown 互转导出。
 * 通过父组件 key 重挂载以切换笔记；异步加载的 content 会由 hook 同步到编辑器。 */
export function RichTextEditor({ content, onChange, repoPath, onOpenWiki, notePath, onConvert, outlineOpen = false, onOutlineToggle = () => undefined }: RichTextEditorProps) {
  const { editor, handleFiles, status, exportMarkdown, importMarkdown } = useRichTextEditor({ content, onChange, repoPath });
  const outline = useRichTextOutline(editor);
  const openTagIndex = useUiStore((s) => s.openTagIndex);
  const ai = useAiWrite({ getSelection: () => ({ ...getTipTapSelection(editor, noteTitleOf(notePath)), fullText: editor?.getText() ?? "" }), onApply: (text) => applyToTipTapEditor(editor, text) });

  return (
    <div className="rich-text-editor flex h-full min-h-0 flex-col" onClick={(event) => handleEditorClick(event, onOpenWiki, openTagIndex)}>
      <div className="flex items-center"><RichTextToolbar editor={editor} onImagePicked={handleFiles} status={status} onExportMarkdown={exportMarkdown} onImportMarkdown={importMarkdown} onConvertToMarkdown={() => convertToMarkdown(editor, notePath, onConvert)} /><AiToolbarButton onOpen={ai.openMenu} compact /></div>
      <RichTextBubbleMenu editor={editor} />
      <AiWriteControls ai={ai} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <NoteOutlineFloating items={outline} open={outlineOpen} onToggle={onOutlineToggle} onSelect={(item) => scrollToOutline(editor, item)} />
        <EditorContent editor={editor} className="rich-text-scroll min-h-0 flex-1 overflow-y-auto px-8 py-4" />
      </div>
    </div>
  );
}

/** 提取笔记标题（续写上下文）。 */
function noteTitleOf(notePath: string): string {
  return notePath.split("/").at(-1)?.replace(/\.(ainote|md)$/, "") ?? "";
}

/** 富文本转 Markdown：写新扩展名文件并删除旧文件由 command 层完成。 */
function convertToMarkdown(editor: Editor | null, notePath: string, onConvert?: (to: string, content: string) => void): void {
  if (!editor) return;
  const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
  onConvert?.(swapNoteExtension(notePath, "markdown"), storage.markdown.getMarkdown());
}

/** 点击委托：双链跳转 + 标签索引。 */
function handleEditorClick(event: MouseEvent<HTMLDivElement>, onOpenWiki?: (name: string) => void, openTagIndex?: (tag: string) => void): void {
  const element = event.target as HTMLElement;
  const wikiElement = element.closest("[data-wiki-target]");
  const target = wikiElement?.getAttribute("data-wiki-target");
  if (target) {
    onOpenWiki?.(target);
    return;
  }
  const tagElement = element.closest("[data-tag]");
  const tag = tagElement?.getAttribute("data-tag");
  if (tag) openTagIndex?.(tag);
}

/** 大纲点击：定位到对应标题并聚焦编辑器。 */
function scrollToOutline(editor: Editor | null, item: OutlineItem): void {
  if (!editor) return;
  const headings = editor.view.dom.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
  const heading = headings[item.line];
  const scrollContainer = editor.view.dom.closest<HTMLElement>(".rich-text-scroll");
  if (heading && scrollContainer) {
    const offset = heading.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
    scrollContainer.scrollTop += offset - 16;
  }
  editor.commands.focus(null, { scrollIntoView: false });
}
