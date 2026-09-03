import type { NoteTheme } from "@/stores/ui.store";
import type { TranslationKey } from "@/i18n/messages";

export type NoteThemeMode = "light" | "dark";

export interface NoteThemeOption {
  value: NoteTheme;
  /** 明暗系：驱动 CodeMirror dark 标志与选择器分组 */
  mode: NoteThemeMode;
  labelKey: TranslationKey;
  swatches: ReadonlyArray<string>;
}

/** 选择器 / 设置页画廊的分组：亮色系在前、暗色系在后。 */
export const NOTE_THEME_GROUPS: ReadonlyArray<{ mode: NoteThemeMode; labelKey: "note.themeLightGroup" | "note.themeDarkGroup" }> = [
  { mode: "light", labelKey: "note.themeLightGroup" },
  { mode: "dark", labelKey: "note.themeDarkGroup" },
];

/** 阅读主题注册表：选择器、CodeMirror dark 联动与设置页画廊共用同一份定义。 */
export const NOTE_THEME_OPTIONS: ReadonlyArray<NoteThemeOption> = [
  { value: "classic", mode: "light", labelKey: "note.themeClassic", swatches: ["#f8fafc", "#2563eb", "#334155"] },
  { value: "paper", mode: "light", labelKey: "note.themePaper", swatches: ["#fbf7ef", "#b45309", "#3f3528"] },
  { value: "forest", mode: "light", labelKey: "note.themeForest", swatches: ["#f1f7f2", "#2f855a", "#244239"] },
  { value: "midnight", mode: "dark", labelKey: "note.themeMidnight", swatches: ["#111827", "#7dd3fc", "#dbeafe"] },
  { value: "solar", mode: "light", labelKey: "note.themeSolar", swatches: ["#f5f8fc", "#2f6fed", "#26344c"] },
  { value: "graphite", mode: "dark", labelKey: "note.themeGraphite", swatches: ["#14161b", "#8fa6ff", "#e9ebec"] },
  { value: "inkblue", mode: "dark", labelKey: "note.themeInkblue", swatches: ["#0c1424", "#5aa2ff", "#dbe6f5"] },
  { value: "warmdark", mode: "dark", labelKey: "note.themeWarmdark", swatches: ["#1b1712", "#e8a34d", "#ece4d7"] },
];

/** 未知主题一律回退经典（亮色系），保证 dark 标志不会误判。 */
export function getNoteThemeMode(theme: NoteTheme): NoteThemeMode {
  return NOTE_THEME_OPTIONS.find((option) => option.value === theme)?.mode ?? "light";
}

export function getNoteThemeOption(theme: NoteTheme): NoteThemeOption {
  return NOTE_THEME_OPTIONS.find((option) => option.value === theme) ?? (NOTE_THEME_OPTIONS[0] as NoteThemeOption);
}
