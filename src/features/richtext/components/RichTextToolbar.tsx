import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo,
  SquareCode,
  Strikethrough,
  TextQuote,
  Undo,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface RichTextToolbarProps {
  editor: Editor | null;
}

interface ToolButton {
  key: string;
  icon: LucideIcon;
  labelKey: "richtext.h1" | "richtext.h2" | "richtext.h3" | "richtext.bold" | "richtext.italic" | "richtext.strike" | "richtext.inlineCode" | "richtext.quote" | "richtext.bulletList" | "richtext.orderedList" | "richtext.codeBlock" | "richtext.divider";
  active: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** 行内格式命令表：全部基于 TipTap 命令，无 IPC */
const BUTTONS: ToolButton[] = [
  { key: "h1", icon: Heading1, labelKey: "richtext.h1", active: (e) => e.isActive("heading", { level: 1 }), run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: "h2", icon: Heading2, labelKey: "richtext.h2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: "h3", icon: Heading3, labelKey: "richtext.h3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => void e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: "bold", icon: Bold, labelKey: "richtext.bold", active: (e) => e.isActive("bold"), run: (e) => void e.chain().focus().toggleBold().run() },
  { key: "italic", icon: Italic, labelKey: "richtext.italic", active: (e) => e.isActive("italic"), run: (e) => void e.chain().focus().toggleItalic().run() },
  { key: "strike", icon: Strikethrough, labelKey: "richtext.strike", active: (e) => e.isActive("strike"), run: (e) => void e.chain().focus().toggleStrike().run() },
  { key: "inlineCode", icon: Code, labelKey: "richtext.inlineCode", active: (e) => e.isActive("code"), run: (e) => void e.chain().focus().toggleCode().run() },
  { key: "quote", icon: TextQuote, labelKey: "richtext.quote", active: (e) => e.isActive("blockquote"), run: (e) => void e.chain().focus().toggleBlockquote().run() },
  { key: "bulletList", icon: List, labelKey: "richtext.bulletList", active: (e) => e.isActive("bulletList"), run: (e) => void e.chain().focus().toggleBulletList().run() },
  { key: "orderedList", icon: ListOrdered, labelKey: "richtext.orderedList", active: (e) => e.isActive("orderedList"), run: (e) => void e.chain().focus().toggleOrderedList().run() },
  { key: "codeBlock", icon: SquareCode, labelKey: "richtext.codeBlock", active: (e) => e.isActive("codeBlock"), run: (e) => void e.chain().focus().toggleCodeBlock().run() },
  { key: "divider", icon: Minus, labelKey: "richtext.divider", active: () => false, run: (e) => void e.chain().focus().setHorizontalRule().run() },
];

function ToolbarButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-md transition-colors disabled:opacity-40 ${
        active ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
      }`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon size={15} />
    </button>
  );
}

/** 真富文本编辑器的行内格式工具栏 */
export function RichTextToolbar({ editor }: RichTextToolbarProps) {
  const { t } = useTranslation();
  if (!editor) return <div className="flex items-center gap-0.5 border-b border-border bg-bg-secondary px-3 py-1.5" />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg-secondary px-3 py-1.5">
      {BUTTONS.map(({ key, icon, labelKey, active, run }) => (
        <ToolbarButton key={key} icon={icon} label={t(labelKey)} active={active(editor)} onClick={() => run(editor)} />
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton icon={Undo} label={t("richtext.undo")} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo} label={t("richtext.redo")} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  );
}
