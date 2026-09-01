import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { RichTextToolbar } from "./RichTextToolbar";
import { parseRichTextContent } from "../utils/richText";

interface RichTextEditorProps {
  /** TipTap JSON 字符串（.ainote 文件内容） */
  content: string;
  /** 编辑器变更时输出序列化后的 TipTap JSON 字符串 */
  onChange: (value: string) => void;
}

/** 真富文本所见即所得编辑器：TipTap 读写 TipTap JSON。
 * 通过父组件 key 重挂载以切换/重载笔记，content 仅在首次创建时解析。 */
export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseRichTextContent(content),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
  });

  return (
    <div className="rich-text-editor flex h-full min-h-0 flex-col">
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} className="rich-text-scroll min-h-0 flex-1 overflow-y-auto px-8 py-4" />
    </div>
  );
}
