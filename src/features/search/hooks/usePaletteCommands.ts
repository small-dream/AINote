import { useMemo } from "react";
import { useCommitPendingMutation, useSyncNowMutation } from "@/queries/sync.queries";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import type { CommandPaletteActions } from "../types";
import type { PaletteCommand } from "../utils/palette";

/** 动作命令注册：新建 / 同步 / 保存版本 / 主题 / 语言（纯注册表，无键盘逻辑） */
export function usePaletteCommands(actions: CommandPaletteActions) {
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const { t } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const locale = useUiStore((state) => state.locale);
  const setTheme = useUiStore((state) => state.setTheme);
  const setLocale = useUiStore((state) => state.setLocale);
  const syncNow = useSyncNowMutation();
  const checkpoint = useCommitPendingMutation();

  return useMemo<PaletteCommand[]>(
    () => [
      { id: "new-note", label: t("palette.newNote"), keywords: ["note", "create", "新建"], run: () => { actions.onNewNote(); closePalette(); } },
      { id: "new-folder", label: t("palette.newFolder"), keywords: ["folder", "mkdir", "新建文件夹"], run: () => { actions.onNewFolder(); closePalette(); } },
      { id: "sync-now", label: t("palette.syncNow"), keywords: ["sync", "push", "pull", "同步"], run: () => { syncNow.mutate(); closePalette(); } },
      { id: "checkpoint", label: t("palette.checkpoint"), keywords: ["version", "commit", "保存版本"], run: () => { checkpoint.mutate("note: checkpoint"); closePalette(); } },
      { id: "toggle-theme", label: t("palette.toggleTheme"), keywords: ["dark", "light", "theme", "主题"], run: () => { setTheme(theme === "dark" ? "light" : "dark"); closePalette(); } },
      { id: "toggle-language", label: t("palette.toggleLanguage"), keywords: ["language", "english", "中文", "语言"], run: () => { setLocale(locale === "zh-CN" ? "en-US" : "zh-CN"); closePalette(); } },
    ],
    [t, closePalette, actions, syncNow, checkpoint, theme, locale, setTheme, setLocale],
  );
}
