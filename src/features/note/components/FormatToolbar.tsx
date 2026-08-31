import type { RefObject } from "react";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import {
  setHeading,
  toggleBlock,
  toggleInline,
  type FormatResult,
} from "../utils/format";
import { insertCodeBlock, insertDivider, insertImage, insertTable } from "../utils/insert";
import { useFormatCommands } from "../hooks/useFormatCommands";
import { ToolbarButton } from "./ToolbarButton";
import { HeadingDropdown } from "./HeadingDropdown";
import { useTranslation } from "@/i18n";

interface FormatToolbarProps {
  viewRef: RefObject<EditorView | null>;
  active: Set<string>;
}

interface ButtonSpec {
  icon: LucideIcon;
  labelKey: "note.bold" | "note.italic" | "note.strikethrough" | "note.inlineCode" | "note.quote" | "note.bulletList" | "note.orderedList" | "note.taskList" | "note.image" | "note.codeBlock" | "note.table" | "note.divider";
  shortcut?: string | undefined;
  activeKey?: string | undefined;
  command: (s: EditorState) => FormatResult;
}

const INLINE_BUTTONS: ButtonSpec[] = [
  { icon: Bold, labelKey: "note.bold", shortcut: "⌘B", activeKey: "bold", command: (s) => toggleInline(s, "bold") },
  { icon: Italic, labelKey: "note.italic", shortcut: "⌘I", activeKey: "italic", command: (s) => toggleInline(s, "italic") },
  { icon: Strikethrough, labelKey: "note.strikethrough", shortcut: "⌘⇧X", activeKey: "strikethrough", command: (s) => toggleInline(s, "strikethrough") },
  { icon: Code, labelKey: "note.inlineCode", shortcut: "⌘E", activeKey: "code", command: (s) => toggleInline(s, "code") },
];

const BLOCK_BUTTONS: ButtonSpec[] = [
  { icon: TextQuote, labelKey: "note.quote", activeKey: "quote", command: (s) => toggleBlock(s, "quote") },
  { icon: List, labelKey: "note.bulletList", activeKey: "bulletList", command: (s) => toggleBlock(s, "bullet") },
  { icon: ListOrdered, labelKey: "note.orderedList", activeKey: "orderedList", command: (s) => toggleBlock(s, "ordered") },
  { icon: ListChecks, labelKey: "note.taskList", activeKey: "task", command: (s) => toggleBlock(s, "task") },
];

const INSERT_BUTTONS: ButtonSpec[] = [
  { icon: Image, labelKey: "note.image", command: insertImage },
  { icon: SquareCode, labelKey: "note.codeBlock", command: insertCodeBlock },
  { icon: Table, labelKey: "note.table", command: insertTable },
  { icon: Minus, labelKey: "note.divider", command: insertDivider },
];

/** Markdown 格式工具栏：按编辑任务分组，紧凑且保持键盘焦点。 */
export function FormatToolbar({ viewRef, active }: FormatToolbarProps) {
  const { t } = useTranslation();
  const { run, runLink } = useFormatCommands(viewRef);

  const renderGroup = (buttons: ButtonSpec[]) =>
    buttons.map((b) => (
      <ToolbarButton
        key={b.labelKey}
        icon={b.icon}
        label={t(b.labelKey)}
        shortcut={b.shortcut}
        active={b.activeKey !== undefined && active.has(b.activeKey)}
        onClick={() => run(b.command)}
      />
    ));

  return (
    <div className="flex h-10 items-center gap-1 border-b border-border bg-bg-secondary/60 px-6">
      <div className="flex items-center gap-0.5">{renderGroup(INLINE_BUTTONS)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <HeadingDropdown active={active} onSelect={(level) => run((s) => setHeading(s, level))} />
        {renderGroup(BLOCK_BUTTONS)}
      </div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={Link} label={t("note.link")} shortcut="⌘K" onClick={runLink} />
        {renderGroup(INSERT_BUTTONS)}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-2 h-4 w-px bg-border" />;
}
