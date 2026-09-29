import { ArrowLeftRight, Download, Ellipsis, FolderInput, History, Palette, Printer, ShieldCheck, ShieldOff, Tags, Wand2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAiToolbarAction, type AiToolbarAction } from "@/features/ai/hooks/useAiToolbarAction";
import { NoteThemeOptions } from "./NoteThemePicker";
import { ToolbarMenu, type ToolbarMenuEntry, type ToolbarMenuItem } from "@/components/molecules/ToolbarMenu";

interface ToolbarOverflowMenuProps {
  richText: boolean;
  hasConvert: boolean;
  isPdfAvailable: boolean;
  onHistory: () => void;
  onWiki: () => void;
  onAi?: (() => void) | undefined;
  /** 加密笔记：AI 菜单项禁用并说明原因（决策③） */
  aiBlocked?: boolean;
  /** 加密笔记：笔记历史菜单项禁用并说明原因（决策④） */
  historyBlocked?: boolean;
  onExportPdf?: (() => void) | undefined;
  onExportMarkdown?: (() => void) | undefined;
  onConvert?: (() => void) | undefined;
  /** 富文本 → Markdown（可逆转换，无需确认对话框） */
  onConvertToMarkdown?: (() => void) | undefined;
  onMove: () => void;
  /** 逐篇加密开关（E4）；null 表示当前不可用（未建库或已锁定） */
  onToggleEncryption?: (() => void) | undefined;
  encryptionAction?: "encrypt" | "decrypt";
}

type Translator = ReturnType<typeof useTranslation>["t"];

/** 中频工具组：主题 / 历史 / 双链 / AI，主题项展开为面板内子视图，复用 NoteThemePicker 的选项列表。 */
function toolEntries(props: ToolbarOverflowMenuProps, ai: AiToolbarAction, t: Translator): ToolbarMenuEntry[] {
  const { onHistory, onWiki, onAi, aiBlocked = false, historyBlocked = false } = props;
  const items: ToolbarMenuItem[] = [
    { key: "theme", icon: Palette, label: t("note.theme"), submenu: (close) => <NoteThemeOptions onPicked={close} /> },
    { key: "history", icon: History, label: t("history.title"), disabled: historyBlocked, hint: historyBlocked ? t("vault.historyDisabled") : undefined, onSelect: onHistory },
    { key: "wiki", icon: Tags, label: t("wiki.title"), onSelect: onWiki },
  ];
  if (onAi) items.push(aiEntry(ai, aiBlocked, t));
  return items;
}

/** AI 菜单项：label 恒为「AI 助手」，加密时禁用并说明原因；未配置时把引导文案放到 hint，点击进设置。 */
function aiEntry(ai: AiToolbarAction, aiBlocked: boolean, t: Translator): ToolbarMenuItem {
  const hint = aiBlocked ? t("vault.aiDisabled") : ai.configured ? undefined : ai.label;
  return { key: "ai", icon: Wand2, label: t("ai.title"), disabled: aiBlocked, hint, onSelect: ai.action };
}

/** 低频导出 / 转换操作。 */
function exportEntries(props: ToolbarOverflowMenuProps, t: Translator): ToolbarMenuEntry[] {
  const { richText, hasConvert, isPdfAvailable, onExportPdf, onExportMarkdown, onConvert, onConvertToMarkdown } = props;
  return [
    ...(isPdfAvailable && onExportPdf ? [{ key: "exportPdf", icon: Printer, label: t("note.exportPdf"), onSelect: onExportPdf }] : []),
    ...(onExportMarkdown ? [{ key: "exportMarkdown", icon: Download, label: t("richtext.exportMarkdown"), onSelect: onExportMarkdown }] : []),
    ...(!richText && hasConvert && onConvert ? [{ key: "convert", icon: ArrowLeftRight, label: t("note.convertToRichText"), onSelect: onConvert }] : []),
    ...(richText && onConvertToMarkdown ? [{ key: "convertToMarkdown", icon: ArrowLeftRight, label: t("richtext.convertToMarkdown"), onSelect: onConvertToMarkdown }] : []),
  ];
}

/** 低频文件操作组：导出 / 转换 / 加密 / 移动。 */
function fileEntries(props: ToolbarOverflowMenuProps, t: Translator): ToolbarMenuEntry[] {
  const { onMove, onToggleEncryption, encryptionAction = "encrypt" } = props;
  return [
    ...exportEntries(props, t),
    ...(onToggleEncryption ? [encryptionEntry(encryptionAction, onToggleEncryption, t)] : []),
    { key: "move", icon: FolderInput, label: t("note.moving"), onSelect: onMove },
  ];
}

/** 加密开关菜单项：文案与图标随「加密 / 解密」方向切换。 */
function encryptionEntry(action: "encrypt" | "decrypt", onSelect: () => void, t: Translator): ToolbarMenuItem {
  const decrypting = action === "decrypt";
  return { key: "encryption", icon: decrypting ? ShieldOff : ShieldCheck, label: t(decrypting ? "note.decrypt" : "note.encrypt"), onSelect };
}

/** 工具栏溢出菜单：中频工具（主题 / 历史 / 双链 / AI）与低频文件操作分组收进「⋯」，顶栏只留高频控件。 */
export function ToolbarOverflowMenu(props: ToolbarOverflowMenuProps) {
  const { t } = useTranslation();
  const ai = useAiToolbarAction(props.onAi ?? (() => undefined));
  const entries: ToolbarMenuEntry[] = [...toolEntries(props, ai, t), { type: "divider" }, ...fileEntries(props, t)];
  return <ToolbarMenu icon={Ellipsis} label={t("note.more")} entries={entries} />;
}
