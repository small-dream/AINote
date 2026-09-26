import type { Editor } from "@tiptap/core";
import {
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/messages";
import { requestLinkInput } from "./linkUrl";

export interface EditorToolbarCommand {
  key: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** 标题级别：与 Markdown ATX 标题 `#` 到 `######` 一致 */
type HeadingCommandLevel = 1 | 2 | 3 | 4 | 5 | 6;

const isHeading = (editor: Editor, level: HeadingCommandLevel): boolean => editor.isActive("heading", { level });

/** 一级分组：段落类型用文字选择器收敛，避免 H1-H6 长期占据空间 */
const PARAGRAPH_COMMAND: EditorToolbarCommand = { key: "paragraph", icon: Heading1, labelKey: "richtext.paragraph", isActive: (editor) => !editor.isActive("heading"), run: (editor) => void editor.chain().focus().setParagraph().run() };

export const HEADING_COMMANDS: EditorToolbarCommand[] = [
  PARAGRAPH_COMMAND,
  { key: "h1", icon: Heading1, labelKey: "richtext.h1", isActive: (editor) => isHeading(editor, 1), run: (editor) => void editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", icon: Heading2, labelKey: "richtext.h2", isActive: (editor) => isHeading(editor, 2), run: (editor) => void editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", icon: Heading3, labelKey: "richtext.h3", isActive: (editor) => isHeading(editor, 3), run: (editor) => void editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "h4", icon: Heading4, labelKey: "richtext.h4", isActive: (editor) => isHeading(editor, 4), run: (editor) => void editor.chain().focus().toggleHeading({ level: 4 }).run() },
  { key: "h5", icon: Heading5, labelKey: "richtext.h5", isActive: (editor) => isHeading(editor, 5), run: (editor) => void editor.chain().focus().toggleHeading({ level: 5 }).run() },
  { key: "h6", icon: Heading6, labelKey: "richtext.h6", isActive: (editor) => isHeading(editor, 6), run: (editor) => void editor.chain().focus().toggleHeading({ level: 6 }).run() },
];

/** 二级分组：行内格式（业界工具栏最高频操作） */
export const INLINE_COMMANDS: EditorToolbarCommand[] = [
  { key: "bold", icon: Bold, labelKey: "richtext.bold", isActive: (editor) => editor.isActive("bold"), run: (editor) => void editor.chain().focus().toggleBold().run() },
  { key: "italic", icon: Italic, labelKey: "richtext.italic", isActive: (editor) => editor.isActive("italic"), run: (editor) => void editor.chain().focus().toggleItalic().run() },
  { key: "strike", icon: Strikethrough, labelKey: "richtext.strike", isActive: (editor) => editor.isActive("strike"), run: (editor) => void editor.chain().focus().toggleStrike().run() },
  { key: "inlineCode", icon: Code, labelKey: "richtext.inlineCode", isActive: (editor) => editor.isActive("code"), run: (editor) => void editor.chain().focus().toggleCode().run() },
];

/** 清除格式：去掉行内 mark 与块级类型（标题 / 引用 / 列表回到正文），工具栏与右键菜单共用同一条命令。 */
export const CLEAR_FORMAT_COMMAND: EditorToolbarCommand = {
  key: "clearFormat",
  icon: Eraser,
  labelKey: "editor.clearFormatting",
  run: (editor) => void editor.chain().focus().unsetAllMarks().clearNodes().run(),
};

/** 三级分组：块级写作结构 */
export const BLOCK_COMMANDS: EditorToolbarCommand[] = [
  { key: "quote", icon: TextQuote, labelKey: "richtext.quote", isActive: (editor) => editor.isActive("blockquote"), run: (editor) => void editor.chain().focus().toggleBlockquote().run() },
  { key: "bulletList", icon: List, labelKey: "richtext.bulletList", isActive: (editor) => editor.isActive("bulletList"), run: (editor) => void editor.chain().focus().toggleBulletList().run() },
  { key: "orderedList", icon: ListOrdered, labelKey: "richtext.orderedList", isActive: (editor) => editor.isActive("orderedList"), run: (editor) => void editor.chain().focus().toggleOrderedList().run() },
  { key: "taskList", icon: ListChecks, labelKey: "richtext.taskList", isActive: (editor) => editor.isActive("taskList"), run: (editor) => void editor.chain().focus().toggleTaskList().run() },
];

/** 链接命令：不直接改文档，派发事件交给 LinkButton 弹出 URL 输入（按钮/Mod-k/斜杠命令共用） */
export const LINK_COMMAND: EditorToolbarCommand = {
  key: "link",
  icon: Link,
  labelKey: "note.link",
  isActive: (editor) => editor.isActive("link"),
  run: (editor) => requestLinkInput(editor.view.dom),
};

/** 插入类块级命令直接呈现在工具栏，减少常用结构的操作层级 */
export const INSERT_COMMANDS: EditorToolbarCommand[] = [
  { key: "codeBlock", icon: SquareCode, labelKey: "richtext.codeBlock", isActive: (editor) => editor.isActive("codeBlock"), run: (editor) => void editor.chain().focus().toggleCodeBlock().run() },
  { key: "table", icon: TableIcon, labelKey: "richtext.table", isActive: (editor) => editor.isActive("table"), run: (editor) => void editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: "divider", icon: Minus, labelKey: "richtext.divider", run: (editor) => void editor.chain().focus().setHorizontalRule().run() },
];

export function getActiveHeadingCommand(editor: Editor): EditorToolbarCommand {
  return HEADINGS_ONLY(editor)[0] ?? PARAGRAPH_COMMAND;
}

function HEADINGS_ONLY(editor: Editor): EditorToolbarCommand[] {
  return HEADING_COMMANDS.filter((command) => command.isActive?.(editor));
}
