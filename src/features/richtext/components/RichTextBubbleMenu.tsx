import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
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
  Strikethrough,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface RichTextBubbleMenuProps {
  editor: Editor | null;
}

interface BubbleButton {
  icon: LucideIcon;
  labelKey: "richtext.bold" | "richtext.italic" | "richtext.strike" | "richtext.inlineCode" | "richtext.h1" | "richtext.h2" | "richtext.h3" | "richtext.quote" | "richtext.bulletList" | "richtext.orderedList" | "richtext.taskList";
  active: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** 选中文本时的块级/行级操作浮层 */
const BUBBLE_BUTTONS: BubbleButton[] = [
  { icon: Bold, labelKey: "richtext.bold", active: (e) => e.isActive("bold"), run: (e) => void e.chain().focus().toggleBold().run() },
  { icon: Italic, labelKey: "richtext.italic", active: (e) => e.isActive("italic"), run: (e) => void e.chain().focus().toggleItalic().run() },
  { icon: Strikethrough, labelKey: "richtext.strike", active: (e) => e.isActive("strike"), run: (e) => void e.chain().focus().toggleStrike().run() },
  { icon: Code, labelKey: "richtext.inlineCode", active: (e) => e.isActive("code"), run: (e) => void e.chain().focus().toggleCode().run() },
  { icon: Heading1, labelKey: "richtext.h1", active: (e) => e.isActive("heading", { level: 1 }), run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run() },
  { icon: Heading2, labelKey: "richtext.h2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
  { icon: Heading3, labelKey: "richtext.h3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => void e.chain().focus().toggleHeading({ level: 3 }).run() },
  { icon: TextQuote, labelKey: "richtext.quote", active: (e) => e.isActive("blockquote"), run: (e) => void e.chain().focus().toggleBlockquote().run() },
  { icon: List, labelKey: "richtext.bulletList", active: (e) => e.isActive("bulletList"), run: (e) => void e.chain().focus().toggleBulletList().run() },
  { icon: ListOrdered, labelKey: "richtext.orderedList", active: (e) => e.isActive("orderedList"), run: (e) => void e.chain().focus().toggleOrderedList().run() },
  { icon: ListChecks, labelKey: "richtext.taskList", active: (e) => e.isActive("taskList"), run: (e) => void e.chain().focus().toggleTaskList().run() },
];

export function RichTextBubbleMenu({ editor }: RichTextBubbleMenuProps) {
  const { t } = useTranslation();
  if (!editor) return null;
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ state }) => {
        const { from, to } = state.selection;
        return from !== to && editor.isEditable;
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-bg-primary px-1 py-1 shadow-lg">
        {BUBBLE_BUTTONS.map(({ icon: Icon, labelKey, active, run }) => (
          <button
            key={labelKey}
            type="button"
            title={t(labelKey)}
            aria-label={t(labelKey)}
            aria-pressed={active(editor)}
            className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${active(editor) ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(editor)}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}
