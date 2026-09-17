import { Bold, ClipboardPaste, Code, Copy, Eraser, Italic, Link, Scissors, Sparkles, Strikethrough, TextSelect, type LucideIcon } from "lucide-react";
import type { ContextMenuItem } from "@/components/molecules/EditorContextMenu";
import { EditorContextMenu } from "@/components/molecules/EditorContextMenu";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/i18n";
import { requestLinkInput } from "../utils/linkUrl";
import type { NoteTheme } from "@/stores/ui.store";
import type { NoteEncryptionMenuAction } from "@/features/vault/hooks/useNoteEncryption";
import { encryptionMenuItems } from "@/features/vault/utils/encryptionMenuItem";

interface RichTextContextMenuProps {
  position: { x: number; y: number } | null;
  editor: Editor | null;
  hasSelection: boolean;
  onOpenAi: () => void;
  onClose: () => void;
  noteTheme: NoteTheme;
  /** 逐篇加密/解密入口（仓库已建库时传入） */
  encryption?: NoteEncryptionMenuAction;
}

/** 富文本右键菜单：与 Markdown 共用信息层级，动作换成 TipTap 语义 */
export function RichTextContextMenu({ position, editor, hasSelection, onOpenAi, onClose, noteTheme, encryption }: RichTextContextMenuProps) {
  const { t } = useTranslation();
  if (!editor) return null;
  const items: ContextMenuItem[] = [
    action("cut", Scissors, t("editor.cut"), () => runNativeCommand(editor, "cut")),
    action("copy", Copy, t("editor.copy"), () => runNativeCommand(editor, "copy")),
    { key: "paste", icon: ClipboardPaste, label: t("editor.paste"), onSelect: () => void pastePlainText(editor) },
    { key: "select-all", icon: TextSelect, label: t("editor.selectAll"), onSelect: () => { editor.commands.selectAll(); editor.commands.focus(); } },
    { kind: "separator", key: "clipboard-separator" },
    action("bold", Bold, t("richtext.bold"), () => void editor.chain().focus().toggleBold().run(), !hasSelection),
    action("italic", Italic, t("richtext.italic"), () => void editor.chain().focus().toggleItalic().run(), !hasSelection),
    action("strike", Strikethrough, t("richtext.strike"), () => void editor.chain().focus().toggleStrike().run(), !hasSelection),
    action("code", Code, t("richtext.inlineCode"), () => void editor.chain().focus().toggleCode().run(), !hasSelection),
    action("link", Link, t("note.link"), () => requestLinkInput(editor.view.dom)),
    action("clear", Eraser, t("editor.clearFormatting"), () => void editor.chain().focus().unsetAllMarks().clearNodes().run()),
    { kind: "separator", key: "format-separator" },
    { key: "ai", icon: Sparkles, label: t("ai.actionTitle"), onSelect: onOpenAi },
    ...encryptionMenuItems(encryption, t),
  ];
  return <EditorContextMenu position={position} label={t("editor.contextMenu")} items={items} noteTheme={noteTheme} onClose={onClose} />;
}

function action(key: string, icon: LucideIcon, label: string, onSelect: () => void, disabled = false): ContextMenuItem {
  return { key, icon, label, onSelect, ...(disabled ? { disabled: true } : {}) };
}

function runNativeCommand(editor: Editor, command: "cut" | "copy"): void {
  editor.commands.focus();
  document.execCommand(command);
}

async function pastePlainText(editor: Editor): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, text).run();
  } catch {
    editor.commands.focus();
  }
}
