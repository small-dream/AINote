import { type ChangeEvent, type RefObject } from "react";
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
import { setHeading, toggleBlock, toggleInline, type FormatResult } from "../utils/format";
import { insertCodeBlock, insertDivider, insertImage, insertTable } from "../utils/insert";
import { useFormatCommands } from "../hooks/useFormatCommands";
import { ToolbarButton } from "./ToolbarButton";
import { HeadingDropdown } from "./HeadingDropdown";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";

interface FormatToolbarProps {
  viewRef: RefObject<EditorView | null>;
  active: Set<string>;
  /** 提供时图片按钮改为本地文件选择器（P1-4 图片/附件管理） */
  onImagePicked?: (files: File[]) => void;
  /** 资产导入瞬时状态提示（成功 / 失败） */
  status?: string | null;
}

interface ButtonSpec {
  icon: LucideIcon;
  labelKey: "note.bold" | "note.italic" | "note.strikethrough" | "note.inlineCode" | "note.quote" | "note.bulletList" | "note.orderedList" | "note.taskList" | "note.image" | "note.codeBlock" | "note.table" | "note.divider";
  shortcut?: string | undefined;
  activeKey?: string | undefined;
  command: (s: EditorState) => FormatResult;
}

interface RenderButtonsOptions {
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  active: Set<string>;
  run: (fn: (s: EditorState) => FormatResult) => void;
  onImagePicked?: ((files: File[]) => void) | undefined;
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

/** 图片按钮的文件选择器形态：label 原生触发隐藏 input，无需 ref 编程点击 */
function ImagePickerButton({ label, onPicked }: { label: string; onPicked: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onPicked(files);
  };
  return (
    <label aria-label={label} title={label} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-120 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary">
      <Image size={16} />
      <input type="file" multiple className="hidden" onChange={handleChange} />
    </label>
  );
}

/** 分组按钮渲染：图片按钮在提供选择器时渲染为文件选择器 */
function renderButtons(buttons: ButtonSpec[], opts: RenderButtonsOptions) {
  return buttons.map((b) =>
    b.labelKey === "note.image" && opts.onImagePicked ? (
      <ImagePickerButton key={b.labelKey} label={opts.t(b.labelKey)} onPicked={opts.onImagePicked} />
    ) : (
      <ToolbarButton
        key={b.labelKey}
        icon={b.icon}
        label={opts.t(b.labelKey)}
        shortcut={b.shortcut}
        active={b.activeKey !== undefined && opts.active.has(b.activeKey)}
        onClick={() => opts.run(b.command)}
      />
    )
  );
}

/** Markdown 格式工具栏：按编辑任务分组，紧凑且保持键盘焦点。 */
export function FormatToolbar({ viewRef, active, onImagePicked, status }: FormatToolbarProps) {
  const { t } = useTranslation();
  const { run, runLink } = useFormatCommands(viewRef);
  const opts = { t, active, run, onImagePicked };
  return (
    <div className="flex h-10 items-center gap-1 border-b border-border bg-bg-secondary/60 px-6">
      <div className="flex items-center gap-0.5">{renderButtons(INLINE_BUTTONS, opts)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <HeadingDropdown active={active} onSelect={(level) => run((s) => setHeading(s, level))} />
        {renderButtons(BLOCK_BUTTONS, opts)}
      </div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={Link} label={t("note.link")} shortcut="⌘K" onClick={runLink} />
        {renderButtons(INSERT_BUTTONS, opts)}
      </div>
      {status ? (
        <span role="status" className="ml-auto max-w-72 truncate text-xs text-text-secondary">
          {status}
        </span>
      ) : null}
    </div>
  );
}

function Divider() {
  return <span className="mx-2 h-4 w-px bg-border" />;
}
