import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type Locale = "zh-CN" | "en-US";
export type NoteTheme = "classic" | "paper" | "midnight" | "forest" | "solar" | "graphite" | "inkblue" | "warmdark";
export type NoteThemeScope = "content" | "workspace";
export type SidebarTab = "tree" | "favorites" | "tags" | "trash";
/** 设置页左侧分类导航的激活项 */
export type SettingsTab = "repositories" | "appearance" | "language" | "ai" | "updates" | "account";

/** 主题偏好持久化键（localStorage，纯前端全局 UI 态） */
export const THEME_STORAGE_KEY = "ainote.theme";
export const LOCALE_STORAGE_KEY = "ainote.locale";
export const NOTE_THEME_STORAGE_KEY = "ainote.note-theme";
export const NOTE_THEME_SCOPE_STORAGE_KEY = "ainote.note-theme-scope";
export const SIDEBAR_WIDTH_STORAGE_KEY = "ainote.sidebar-width";
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 248;

/** 解析 localStorage 值；非法值一律回退亮色 */
export function parseTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : value === "system" ? "system" : "light";
}

/** 解析「跟随系统」后的实际明暗值；无 matchMedia 环境一律回退亮色。 */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
  return theme === "dark" || (theme === "system" && systemPrefersDark) ? "dark" : "light";
}

/** 解析显示语言；非法值一律回退简体中文。 */
export function parseLocale(value: string | null): Locale {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function parseNoteTheme(value: string | null): NoteTheme {
  return value === "paper" || value === "midnight" || value === "forest" || value === "solar" || value === "graphite" || value === "inkblue" || value === "warmdark" ? value : "classic";
}

export function parseNoteThemeScope(value: string | null): NoteThemeScope {
  return value === "content" ? "content" : "workspace";
}

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

export function parseSidebarWidth(value: string | null): number {
  const width = Number.parseInt(value ?? "", 10);
  return Number.isFinite(width) ? clampSidebarWidth(width) : SIDEBAR_DEFAULT_WIDTH;
}

/** 探测 localStorage 是否真正可用（Node 26+ 实验性 localStorage 会定义但无法使用） */
function isLocalStorageAvailable(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const probe = "__ainote_ls_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const localStorageAvailable = isLocalStorageAvailable();

export function readStoredTheme(): Theme {
  if (!localStorageAvailable) return "light";
  return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function writeStoredTheme(theme: Theme): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readStoredLocale(): Locale {
  if (!localStorageAvailable) return "zh-CN";
  return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function writeStoredLocale(locale: Locale): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function readStoredNoteTheme(): NoteTheme {
  if (!localStorageAvailable) return "classic";
  return parseNoteTheme(localStorage.getItem(NOTE_THEME_STORAGE_KEY));
}

export function writeStoredNoteTheme(noteTheme: NoteTheme): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(NOTE_THEME_STORAGE_KEY, noteTheme);
}

export function readStoredNoteThemeScope(): NoteThemeScope {
  if (!localStorageAvailable) return "workspace";
  return parseNoteThemeScope(localStorage.getItem(NOTE_THEME_SCOPE_STORAGE_KEY));
}

export function writeStoredNoteThemeScope(scope: NoteThemeScope): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(NOTE_THEME_SCOPE_STORAGE_KEY, scope);
}

export function readStoredSidebarWidth(): number {
  if (!localStorageAvailable) return SIDEBAR_DEFAULT_WIDTH;
  return parseSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
}

export function writeStoredSidebarWidth(sidebarWidth: number): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(sidebarWidth)));
}

interface UiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  focusedTag: string | null;
  askAiOpen: boolean;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  theme: Theme;
  noteTheme: NoteTheme;
  noteThemeScope: NoteThemeScope;
  locale: Locale;
  toggleSidebar: () => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  persistSidebarWidth: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  openTagIndex: (tag: string) => void;
  openAskAi: () => void;
  closeAskAi: () => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setTheme: (theme: Theme) => void;
  setNoteTheme: (noteTheme: NoteTheme) => void;
  setNoteThemeScope: (scope: NoteThemeScope) => void;
  setLocale: (locale: Locale) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  sidebarWidth: readStoredSidebarWidth(),
  sidebarTab: "tree",
  focusedTag: null,
  askAiOpen: false,
  settingsOpen: false,
  settingsTab: "repositories",
  theme: readStoredTheme(),
  noteTheme: readStoredNoteTheme(),
  noteThemeScope: readStoredNoteThemeScope(),
  locale: readStoredLocale(),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: clampSidebarWidth(sidebarWidth) }),
  persistSidebarWidth: () => set((state) => {
    writeStoredSidebarWidth(state.sidebarWidth);
    return {};
  }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  openTagIndex: (tag) => set({ sidebarTab: "tags", focusedTag: tag }),
  openAskAi: () => set({ askAiOpen: true }),
  closeAskAi: () => set({ askAiOpen: false }),
  openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  setTheme: (theme) => {
    writeStoredTheme(theme);
    set({ theme });
  },
  setNoteTheme: (noteTheme) => {
    writeStoredNoteTheme(noteTheme);
    set({ noteTheme });
  },
  setNoteThemeScope: (noteThemeScope) => {
    writeStoredNoteThemeScope(noteThemeScope);
    set({ noteThemeScope });
  },
  setLocale: (locale) => {
    writeStoredLocale(locale);
    set({ locale });
  },
}));
