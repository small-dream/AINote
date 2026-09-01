import type { ChangeEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  TextQuote,
  Trash2,
  Undo,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface RichTextToolbarProps {
  editor: Editor | null;
  onImagePicked?: (files: File[]) => void;
  status?: string | null;
}

interface ToolButton {
  key: string;
  icon: LucideIcon;
  labelKey: "richtext.h1" | "richtext.h2" | "richtext.h3" | "richtext.bold" | "richtext.italic" | "richtext.strike" | "richtext.inlineCode" | "richtext.quote" | "richtext.bulletList" | "richtext.orderedList" | "richtext.codeBlock" | "richtext.divider" | "richtext.table" | "richtext.deleteTable";
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
  { key: "table", icon: TableIcon, labelKey: "richtext.table", active: (e) => e.isActive("table"), run: (e) => void e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
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

function ImagePickerButton({ label, onPicked }: { label: string; onPicked: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onPicked(files);
  };
  return (
    <label title={label} aria-label={label} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary">
      <ImageIcon size={15} />
      <input type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </label>
  );
}

/** 真富文本编辑器的行内格式工具栏 */
export function RichTextToolbar({ editor, onImagePicked, status }: RichTextToolbarProps) {
  const { t } = useTranslation();
  if (!editor) return <div className="flex items-center gap-0.5 border-b border-border bg-bg-secondary px-3 py-1.5" />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg-secondary px-3 py-1.5">
      {BUTTONS.map(({ key, icon, labelKey, active, run }) => (
        <ToolbarButton key={key} icon={icon} label={t(labelKey)} active={active(editor)} onClick={() => run(editor)} />
      ))}
      {onImagePicked ? <ImagePickerButton label={t("richtext.image")} onPicked={onImagePicked} /> : null}
      {editor.isActive("table") ? <ToolbarButton icon={Trash2} label={t("richtext.deleteTable")} onClick={() => editor.chain().focus().deleteTable().run()} /> : null}
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton icon={Undo} label={t("richtext.undo")} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo} label={t("richtext.redo")} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      {status ? <span role="status" className="ml-2 truncate text-xs text-text-secondary">{status}</span> : null}
    </div>
  );
}
