import { useTranslation } from "@/i18n";
import type { Editor } from "@tiptap/core";
import { Eraser, Image as ImageIcon, Paintbrush, Plus, Redo, Undo } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { ToolbarMenu, type ToolbarMenuItem } from "@/components/molecules/ToolbarMenu";
import { LinkButton } from "./LinkButton";
import { BLOCK_COMMANDS, CLEAR_FORMAT_COMMAND, getActiveHeadingCommand, HEADING_COMMANDS, INLINE_COMMANDS, INSERT_COMMANDS, type EditorToolbarCommand } from "../utils/toolbarCommands";
import { useFormatPainter } from "../hooks/useFormatPainter";
import { TextStylePanel } from "./TextStylePanel";

interface RichTextToolbarProps {
  editor: Editor | null;
  onImagePicked?: ((files: File[]) => void) | undefined;
  status?: string | null | undefined;
}

export function RichTextToolbar({ editor, onImagePicked, status }: RichTextToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="format-toolbar flex w-full min-h-10 items-center gap-1 overflow-x-auto border-b border-border bg-bg-secondary/60 px-6">
      {editor ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <HeadingSelector editor={editor} />
          <ToolbarDivider />
          <ToolbarCommandGroup editor={editor} commands={INLINE_COMMANDS} />
          <FormatPainterButton editor={editor} />
          <ToolbarButton icon={Eraser} label={t("editor.clearFormatting")} onClick={() => CLEAR_FORMAT_COMMAND.run(editor)} />
          <TextStylePanel editor={editor} tooltipPortal />
          <LinkButton editor={editor} variant="toolbar" tooltipPortal />
          <ToolbarDivider />
          <ToolbarCommandGroup editor={editor} commands={BLOCK_COMMANDS} />
          <ToolbarDivider />
          <InsertMenu editor={editor} onImagePicked={onImagePicked} />
        </div>
      ) : null}
      <ToolbarHistoryGroup editor={editor} status={status} />
    </div>
  );
}

/** 插入类块级命令（代码块 / 表格 / 分割线 / 图片）：低频，收进「插入」下拉菜单。 */
function InsertMenu({ editor, onImagePicked }: { editor: Editor; onImagePicked?: ((files: File[]) => void) | undefined }) {
  const { t } = useTranslation();
  const items: ToolbarMenuItem[] = [
    ...INSERT_COMMANDS.map(({ key, icon, labelKey, isActive, run }) => ({ key, label: t(labelKey), icon, active: Boolean(isActive?.(editor)), onSelect: () => run(editor) })),
    ...(onImagePicked ? [{ key: "image", label: t("richtext.image"), icon: ImageIcon, accept: "image/*", onPickFiles: onImagePicked }] : []),
  ];
  return <ToolbarMenu variant="format" icon={Plus} label={t("richtext.insert")} tooltipPortal entries={items} />;
}

/** 格式刷：单击复制当前格式，随后选中目标文本即自动套用；待刷态再次单击取消。 */
function FormatPainterButton({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const painter = useFormatPainter(editor);
  const label = painter.armed ? t("richtext.formatPainterArmed") : t("richtext.formatPainter");
  return (
    <>
      <ToolbarButton icon={Paintbrush} label={label} active={painter.armed} onClick={painter.toggle} />
      {painter.armed ? <span className="hidden shrink-0 pr-1 text-xs text-accent lg:inline">{t("richtext.formatPainterArmed")}</span> : null}
    </>
  );
}

function HeadingSelector({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const activeCommand = getActiveHeadingCommand(editor);
  const items = HEADING_ITEMS(editor, t);
  return <ToolbarMenu variant="format" label={t("note.headingLevel")} text={activeCommand.key === "paragraph" ? t(activeCommand.labelKey) : activeCommand.key.toUpperCase()} active={activeCommand.key !== "paragraph"} tooltipPortal entries={items} />;
}

/** 右侧只放编辑历史：阅读主题与 AI 入口统一收在顶部工具栏（EditorToolbar），两种笔记类型保持同一位置。 */
function ToolbarHistoryGroup({ editor, status }: Pick<RichTextToolbarProps, "editor" | "status">) {
  const { t } = useTranslation();

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {status ? <span role="status" className="mr-1 hidden truncate text-xs text-text-secondary lg:block">{status}</span> : null}
      <ToolbarButton icon={Undo} label={t("richtext.undo")} disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo} label={t("richtext.redo")} disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} />
    </div>
  );
}

function HEADING_ITEMS(editor: Editor, t: ReturnType<typeof useTranslation>["t"]): ToolbarMenuItem[] {
  return HEADING_COMMANDS.map(({ key, icon, labelKey, isActive, run }) => ({
    key,
    label: t(labelKey),
    icon,
    active: Boolean(isActive?.(editor)),
    role: "menuitemradio" as const,
    onSelect: () => run(editor),
  }));
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}

function ToolbarButton({ icon, label, active, disabled, onClick }: { icon: EditorToolbarCommand["icon"]; label: string; active?: boolean | undefined; disabled?: boolean | undefined; onClick: () => void }) {
  const state = active ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary";
  const Icon = icon;
  return (
    <Tooltip content={label} placement="bottom" portal>
      <button type="button" aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 ${state}`}>
        <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function ToolbarCommandGroup({ editor, commands }: { editor: Editor; commands: EditorToolbarCommand[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-0.5">
      {commands.map(({ key, icon, labelKey, isActive, run }) => (
        <ToolbarButton key={key} icon={icon} label={t(labelKey)} active={Boolean(isActive?.(editor))} onClick={() => run(editor)} />
      ))}
    </div>
  );
}
