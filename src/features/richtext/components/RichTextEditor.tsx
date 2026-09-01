import type { MouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { AinoteImage } from "../extensions/image";
import { WikiLink } from "../extensions/wikiLink";
import { RichTextToolbar } from "./RichTextToolbar";
import { useRichTextAssets } from "../hooks/useRichTextAssets";
import { parseRichTextContent } from "../utils/richText";

interface RichTextEditorProps {
  /** TipTap JSON 字符串（.ainote 文件内容） */
  content: string;
  /** 编辑器变更时输出序列化后的 TipTap JSON 字符串 */
  onChange: (value: string) => void;
  /** 活动仓库绝对路径：用于把图片仓库相对路径解析为本地 URL */
  repoPath: string | null;
  /** 点击 `[[双链]]` 时回调目标名（与 Markdown 预览一致） */
  onOpenWiki?: (name: string) => void;
}

/** 真富文本所见即所得编辑器：TipTap 读写 TipTap JSON（图片/表格/双链）。
 * 通过父组件 key 重挂载以切换/重载笔记，content 仅在首次创建时解析。 */
export function RichTextEditor({ content, onChange, repoPath, onOpenWiki }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      AinoteImage.configure({ repoPath }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      WikiLink,
    ],
    content: parseRichTextContent(content),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
  });
  const { handleFiles, status } = useRichTextAssets(editor);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const element = (event.target as HTMLElement).closest("[data-wiki-target]");
    const target = element?.getAttribute("data-wiki-target");
    if (target) onOpenWiki?.(target);
  };

  return (
    <div className="rich-text-editor flex h-full min-h-0 flex-col" onClick={handleClick}>
      <RichTextToolbar editor={editor} onImagePicked={handleFiles} status={status} />
      <EditorContent editor={editor} className="rich-text-scroll min-h-0 flex-1 overflow-y-auto px-8 py-4" />
    </div>
  );
}
