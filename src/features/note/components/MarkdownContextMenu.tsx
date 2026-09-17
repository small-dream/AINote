import { Bold, ClipboardPaste, Code, Copy, Italic, Link, Scissors, Sparkles, Strikethrough, TextSelect, type LucideIcon } from "lucide-react";
import type { ContextMenuItem } from "@/components/molecules/EditorContextMenu";
import { EditorContextMenu } from "@/components/molecules/EditorContextMenu";
import { useTranslation } from "@/i18n";
import type { NoteTheme } from "@/stores/ui.store";
import type { useMarkdownContextMenu } from "../hooks/useMarkdownContextMenu";
import type { NoteEncryptionMenuAction } from "@/features/vault/hooks/useNoteEncryption";
import { encryptionMenuItems } from "@/features/vault/utils/encryptionMenuItem";

type MarkdownContextMenu = ReturnType<typeof useMarkdownContextMenu>;

interface MarkdownContextMenuProps {
  menu: MarkdownContextMenu;
  noteTheme: NoteTheme;
  /** 加密笔记：不渲染 AI 菜单项（决策③，含解锁态，不提供入口） */
  aiBlocked?: boolean;
  /** 逐篇加密/解密入口（仓库已建库时传入） */
  encryption?: NoteEncryptionMenuAction;
}

/** Markdown 右键菜单：先给剪贴板和高频格式，再进入完整 AI 写作面板 */
export function MarkdownContextMenu({ menu, noteTheme, aiBlocked = false, encryption }: MarkdownContextMenuProps) {
  const { t } = useTranslation();
  const items: ContextMenuItem[] = [
    ...clipboardItems(menu, t),
    { kind: "separator", key: "clipboard-separator" },
    ...formatItems(menu, Boolean(menu.position?.hasSelection), t),
    ...aiItems(menu, t, aiBlocked),
    ...encryptionMenuItems(encryption, t),
  ];
  return <EditorContextMenu position={menu.position} label={t("editor.contextMenu")} items={items} noteTheme={noteTheme} onClose={menu.close} />;
}

type ContextMenuTranslator = ReturnType<typeof useTranslation>["t"];

function aiItems(menu: MarkdownContextMenu, t: ContextMenuTranslator, aiBlocked: boolean): ContextMenuItem[] {
  if (aiBlocked) return [];
  return [
    { kind: "separator", key: "format-separator" },
    { key: "ai", icon: Sparkles, label: t("ai.actionTitle"), onSelect: menu.openAi },
  ];
}

function clipboardItems(menu: MarkdownContextMenu, t: ContextMenuTranslator): ContextMenuItem[] {
  return [
    action("cut", Scissors, t("editor.cut"), () => menu.runClipboard("cut")),
    action("copy", Copy, t("editor.copy"), () => menu.runClipboard("copy")),
    { key: "paste", icon: ClipboardPaste, label: t("editor.paste"), onSelect: menu.runPaste },
    { key: "select-all", icon: TextSelect, label: t("editor.selectAll"), onSelect: menu.runSelectAll },
  ];
}

function formatItems(menu: MarkdownContextMenu, hasSelection: boolean, t: ContextMenuTranslator): ContextMenuItem[] {
  const disabled = !hasSelection;
  return [
    action("bold", Bold, t("note.bold"), () => menu.runInline("bold"), disabled),
    action("italic", Italic, t("note.italic"), () => menu.runInline("italic"), disabled),
    action("strike", Strikethrough, t("note.strikethrough"), () => menu.runInline("strikethrough"), disabled),
    action("code", Code, t("note.inlineCode"), () => menu.runInline("code"), disabled),
    action("link", Link, t("note.link"), menu.runLink),
  ];
}

function action(key: string, icon: LucideIcon, label: string, onSelect: () => void, disabled = false): ContextMenuItem {
  return { key, icon, label, onSelect, ...(disabled ? { disabled: true } : {}) };
}
