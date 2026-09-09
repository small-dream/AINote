import { useTranslation } from "@/i18n";
import type { ChangeEvent, ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { Image as ImageIcon, Redo, Undo } from "lucide-react";
import { ToolbarPopover, type ToolbarMenuItem } from "./ToolbarPopover";
import { BLOCK_COMMANDS, getActiveHeadingCommand, HEADING_COMMANDS, INLINE_COMMANDS, INSERT_COMMANDS, type EditorToolbarCommand } from "../utils/toolbarCommands";
import { NoteThemePicker } from "@/features/note/components/NoteThemePicker";

interface RichTextToolbarProps {
  editor: Editor | null;
  onImagePicked?: ((files: File[]) => void) | undefined;
  status?: string | null | undefined;
  trailing?: ReactNode | undefined;
}

export function RichTextToolbar({ editor, onImagePicked, status, trailing }: RichTextToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="format-toolbar flex w-full min-h-10 items-center gap-1 overflow-x-auto border-b border-border bg-bg-secondary px-2 py-1.5">
      {editor ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <HeadingSelector editor={editor} />
          <ToolbarDivider />
          <ToolbarCommandGroup editor={editor} commands={INLINE_COMMANDS} />
          <ToolbarDivider />
          <ToolbarCommandGroup editor={editor} commands={BLOCK_COMMANDS} />
          <ToolbarDivider />
          <ToolbarCommandGroup editor={editor} commands={INSERT_COMMANDS} />
          {onImagePicked ? <ImagePickerButton label={t("richtext.image")} onPicked={onImagePicked} /> : null}
        </div>
      ) : null}
      <ToolbarHistoryGroup editor={editor} status={status} trailing={trailing} />
    </div>
  );
}

function HeadingSelector({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const activeCommand = getActiveHeadingCommand(editor);
  const items = HEADING_ITEMS(editor, t);
  return <ToolbarPopover label={t("note.headingLevel")} text={activeCommand.key === "paragraph" ? t(activeCommand.labelKey) : activeCommand.key.toUpperCase()} active={activeCommand.key !== "paragraph"} items={items} />;
}

function ImagePickerButton({ label, onPicked }: { label: string; onPicked: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onPicked(files);
  };
  return (
    <label title={label} aria-label={label} className="group inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-text-secondary transition-[background-color,border-color,color,transform] duration-150 hover:border-border hover:bg-bg-tertiary hover:text-text-primary active:scale-[0.96]">
      <ImageIcon size={16} strokeWidth={1.9} aria-hidden="true" />
      <input type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </label>
  );
}

type ToolbarHistoryGroupProps = Pick<RichTextToolbarProps, "editor" | "status" | "trailing">;

function ToolbarHistoryGroup({ editor, status, trailing }: ToolbarHistoryGroupProps) {
  const { t } = useTranslation();

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {status ? <span role="status" className="mr-1 hidden truncate text-xs text-text-secondary lg:block">{status}</span> : null}
      <ToolbarButton icon={Undo} label={t("richtext.undo")} disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo} label={t("richtext.redo")} disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} />
      <NoteThemePicker />
      {trailing}
    </div>
  );
}

function HEADING_ITEMS(editor: Editor, t: ReturnType<typeof useTranslation>["t"]): ToolbarMenuItem[] {
  return HEADING_COMMANDS.map(({ key, icon, labelKey, isActive, run }) => ({
    key,
    label: t(labelKey),
    icon,
    active: Boolean(isActive?.(editor)),
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
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 ${state}`}>
      <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
    </button>
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
