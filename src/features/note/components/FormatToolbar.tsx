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

interface FormatToolbarProps {
  viewRef: RefObject<EditorView | null>;
  active: Set<string>;
}

interface ButtonSpec {
  icon: LucideIcon;
  label: string;
  shortcut?: string | undefined;
  activeKey?: string | undefined;
  command: (s: EditorState) => FormatResult;
}

const INLINE_BUTTONS: ButtonSpec[] = [
  { icon: Bold, label: "加粗", shortcut: "⌘B", activeKey: "bold", command: (s) => toggleInline(s, "bold") },
  { icon: Italic, label: "斜体", shortcut: "⌘I", activeKey: "italic", command: (s) => toggleInline(s, "italic") },
  { icon: Strikethrough, label: "删除线", shortcut: "⌘⇧X", activeKey: "strikethrough", command: (s) => toggleInline(s, "strikethrough") },
  { icon: Code, label: "行内代码", shortcut: "⌘E", activeKey: "code", command: (s) => toggleInline(s, "code") },
];

const BLOCK_BUTTONS: ButtonSpec[] = [
  { icon: TextQuote, label: "引用", activeKey: "quote", command: (s) => toggleBlock(s, "quote") },
  { icon: List, label: "无序列表", activeKey: "bulletList", command: (s) => toggleBlock(s, "bullet") },
  { icon: ListOrdered, label: "有序列表", activeKey: "orderedList", command: (s) => toggleBlock(s, "ordered") },
  { icon: ListChecks, label: "任务列表", activeKey: "task", command: (s) => toggleBlock(s, "task") },
];

const INSERT_BUTTONS: ButtonSpec[] = [
  { icon: Image, label: "图片", command: insertImage },
  { icon: SquareCode, label: "代码块", command: insertCodeBlock },
  { icon: Table, label: "表格", command: insertTable },
  { icon: Minus, label: "分割线", command: insertDivider },
];

/** Markdown 格式工具栏：行内 / 段落 / 插入三组，仅编辑模式渲染 */
export function FormatToolbar({ viewRef, active }: FormatToolbarProps) {
  const { run, runLink } = useFormatCommands(viewRef);

  const renderGroup = (buttons: ButtonSpec[]) =>
    buttons.map((b) => (
      <ToolbarButton
        key={b.label}
        icon={b.icon}
        label={b.label}
        shortcut={b.shortcut}
        active={b.activeKey !== undefined && active.has(b.activeKey)}
        onClick={() => run(b.command)}
      />
    ));

  return (
    <div className="flex h-10 items-center border-b border-border px-6">
      <div className="flex items-center gap-0.5">{renderGroup(INLINE_BUTTONS)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <HeadingDropdown active={active} onSelect={(level) => run((s) => setHeading(s, level))} />
        {renderGroup(BLOCK_BUTTONS)}
      </div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={Link} label="链接" shortcut="⌘K" onClick={runLink} />
        {renderGroup(INSERT_BUTTONS)}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-2 h-4 w-px bg-border" />;
}
