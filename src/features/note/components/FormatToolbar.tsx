import { type RefObject } from "react";
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
  Plus,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  Undo,
  Redo,
  type LucideIcon,
} from "lucide-react";
import { redo, undo } from "@codemirror/commands";
import { setHeading, toggleBlock, toggleInline, type FormatResult } from "../utils/format";
import { insertCodeBlock, insertDivider, insertImage, insertTable } from "../utils/insert";
import { useFormatCommands } from "../hooks/useFormatCommands";
import { DiagnosticsToolbarButton } from "@/features/diagnostics/components/DiagnosticsToolbarButton";
import type { DiagnosticIssue } from "@/features/diagnostics/utils/diagnostics";
import { ToolbarButton } from "./ToolbarButton";
import { HeadingDropdown } from "./HeadingDropdown";
import { ToolbarMenu, type ToolbarMenuEntry } from "@/components/molecules/ToolbarMenu";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";

interface FormatToolbarProps {
  viewRef: RefObject<EditorView | null>;
  active: Set<string>;
  canUndo?: boolean;
  canRedo?: boolean;
  onLinkInput?: (() => void) | undefined;
  /** 提供时图片菜单项改为本地文件选择器（P1-4 图片/附件管理） */
  onImagePicked?: (files: File[]) => void;
  /** 资产导入瞬时状态提示（成功 / 失败） */
  status?: string | null;
  diagnostics: DiagnosticIssue[];
  diagnosticsOpen: boolean;
  onDiagnosticsToggle: () => void;
  onDiagnosticsSelect: (issue: DiagnosticIssue) => void;
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

/** 插入类块级命令：低频，收进「插入」下拉菜单，图片项在提供选择器时渲染为文件选择器 */
const INSERT_BUTTONS: ButtonSpec[] = [
  { icon: Image, labelKey: "note.image", command: insertImage },
  { icon: SquareCode, labelKey: "note.codeBlock", command: insertCodeBlock },
  { icon: Table, labelKey: "note.table", command: insertTable },
  { icon: Minus, labelKey: "note.divider", command: insertDivider },
];

function insertEntries(t: RenderButtonsOptions["t"], run: RenderButtonsOptions["run"], onImagePicked: FormatToolbarProps["onImagePicked"]): ToolbarMenuEntry[] {
  return INSERT_BUTTONS.map((b) =>
    b.labelKey === "note.image" && onImagePicked
      ? { key: b.labelKey, icon: b.icon, label: t(b.labelKey), accept: "image/*", onPickFiles: onImagePicked }
      : { key: b.labelKey, icon: b.icon, label: t(b.labelKey), onSelect: () => run(b.command) }
  );
}

/** 分组按钮渲染 */
function renderButtons(buttons: ButtonSpec[], opts: RenderButtonsOptions) {
  return buttons.map((b) => (
    <ToolbarButton
      key={b.labelKey}
      icon={b.icon}
      label={opts.t(b.labelKey)}
      shortcut={b.shortcut}
      active={b.activeKey !== undefined && opts.active.has(b.activeKey)}
      onClick={() => opts.run(b.command)}
    />
  ));
}

/** Markdown 格式工具栏：按编辑任务分组，紧凑且保持键盘焦点。 */
export function FormatToolbar({ viewRef, active, canUndo = false, canRedo = false, onLinkInput, onImagePicked, status, diagnostics, diagnosticsOpen, onDiagnosticsToggle, onDiagnosticsSelect }: FormatToolbarProps) {
  const { t } = useTranslation();
  const { run, runLink } = useFormatCommands(viewRef, onLinkInput);
  const opts = { t, active, run };
  return (
    <div className="format-toolbar flex h-10 items-center gap-1 border-b border-border bg-bg-secondary/60 px-6">
      <div className="flex items-center gap-0.5">{renderButtons(INLINE_BUTTONS, opts)}</div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <HeadingDropdown active={active} onSelect={(level) => run((s) => setHeading(s, level))} />
        {renderButtons(BLOCK_BUTTONS, opts)}
      </div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={Link} label={t("note.link")} shortcut="⌘K" onClick={runLink} />
        <ToolbarMenu variant="format" icon={Plus} label={t("note.insert")} entries={insertEntries(t, run, onImagePicked)} />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {status ? (
          <span role="status" className="max-w-72 truncate text-xs text-text-secondary">
            {status}
          </span>
        ) : null}
        <DiagnosticsToolbarButton issues={diagnostics} open={diagnosticsOpen} onToggle={onDiagnosticsToggle} onSelect={onDiagnosticsSelect} />
        <Divider />
        <ToolbarButton icon={Undo} label={t("richtext.undo")} shortcut="⌘Z" disabled={!canUndo} onClick={() => runHistory(viewRef, undo)} />
        <ToolbarButton icon={Redo} label={t("richtext.redo")} shortcut="⌘⇧Z" disabled={!canRedo} onClick={() => runHistory(viewRef, redo)} />
      </div>
    </div>
  );
}

function runHistory(viewRef: RefObject<EditorView | null>, command: typeof undo): void {
  const view = viewRef.current;
  if (!view) return;
  command(view);
  view.focus();
}

function Divider() {
  return <span className="mx-2 h-4 w-px bg-border" />;
}
