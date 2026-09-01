import type { Editor } from "@tiptap/core";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
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

export interface SlashCommandDef {
  key: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  keywords: string[];
  run: (editor: Editor) => void;
}

/** 斜杠命令定义：块类型转换与插入（命令执行前 suggestion 已删除 `/query` 前缀） */
export const SLASH_COMMANDS: SlashCommandDef[] = [
  { key: "h1", labelKey: "richtext.h1", icon: Heading1, keywords: ["heading", "标题", "h1"], run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", labelKey: "richtext.h2", icon: Heading2, keywords: ["heading", "标题", "h2"], run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", labelKey: "richtext.h3", icon: Heading3, keywords: ["heading", "标题", "h3"], run: (e) => void e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "bulletList", labelKey: "richtext.bulletList", icon: List, keywords: ["list", "列表", "ul"], run: (e) => void e.chain().focus().toggleBulletList().run() },
  { key: "orderedList", labelKey: "richtext.orderedList", icon: ListOrdered, keywords: ["list", "列表", "ol"], run: (e) => void e.chain().focus().toggleOrderedList().run() },
  { key: "taskList", labelKey: "richtext.taskList", icon: ListChecks, keywords: ["task", "任务", "todo", "checkbox"], run: (e) => void e.chain().focus().toggleTaskList().run() },
  { key: "quote", labelKey: "richtext.quote", icon: TextQuote, keywords: ["quote", "引用", "blockquote"], run: (e) => void e.chain().focus().toggleBlockquote().run() },
  { key: "codeBlock", labelKey: "richtext.codeBlock", icon: SquareCode, keywords: ["code", "代码"], run: (e) => void e.chain().focus().toggleCodeBlock().run() },
  { key: "table", labelKey: "richtext.table", icon: TableIcon, keywords: ["table", "表格"], run: (e) => void e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: "divider", labelKey: "richtext.divider", icon: Minus, keywords: ["hr", "分割线", "divider"], run: (e) => void e.chain().focus().setHorizontalRule().run() },
  { key: "bold", labelKey: "richtext.bold", icon: Bold, keywords: ["bold", "加粗", "b"], run: (e) => void e.chain().focus().toggleBold().run() },
  { key: "italic", labelKey: "richtext.italic", icon: Italic, keywords: ["italic", "斜体", "i"], run: (e) => void e.chain().focus().toggleItalic().run() },
  { key: "strike", labelKey: "richtext.strike", icon: Strikethrough, keywords: ["strike", "删除线"], run: (e) => void e.chain().focus().toggleStrike().run() },
  { key: "inlineCode", labelKey: "richtext.inlineCode", icon: Code, keywords: ["code", "行内代码"], run: (e) => void e.chain().focus().toggleCode().run() },
];

/** 按查询过滤斜杠命令；空查询返回全部 */
export function filterSlashCommands(query: string): SlashCommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((item) => {
    const hay = `${item.key} ${item.labelKey} ${item.keywords.join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}
