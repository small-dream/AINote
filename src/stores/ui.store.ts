import { create } from "zustand";

export type Theme = "light" | "dark";
export type Locale = "zh-CN" | "en-US";
export type NoteTheme = "classic" | "paper" | "midnight" | "forest";
export type SidebarTab = "tree" | "tags" | "trash";

/** 主题偏好持久化键（localStorage，纯前端全局 UI 态） */
export const THEME_STORAGE_KEY = "ainote.theme";
export const LOCALE_STORAGE_KEY = "ainote.locale";
export const NOTE_THEME_STORAGE_KEY = "ainote.note-theme";

/** 解析 localStorage 值；非法值一律回退亮色 */
export function parseTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : "light";
}

/** 解析显示语言；非法值一律回退简体中文。 */
export function parseLocale(value: string | null): Locale {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function parseNoteTheme(value: string | null): NoteTheme {
  return value === "paper" || value === "midnight" || value === "forest" ? value : "classic";
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

interface UiState {
  sidebarCollapsed: boolean;
  sidebarTab: SidebarTab;
  focusedTag: string | null;
  askAiOpen: boolean;
  settingsOpen: boolean;
  theme: Theme;
  noteTheme: NoteTheme;
  locale: Locale;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  openTagIndex: (tag: string) => void;
  openAskAi: () => void;
  closeAskAi: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (theme: Theme) => void;
  setNoteTheme: (noteTheme: NoteTheme) => void;
  setLocale: (locale: Locale) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  sidebarTab: "tree",
  focusedTag: null,
  askAiOpen: false,
  settingsOpen: false,
  theme: readStoredTheme(),
  noteTheme: readStoredNoteTheme(),
  locale: readStoredLocale(),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  openTagIndex: (tag) => set({ sidebarTab: "tags", focusedTag: tag }),
  openAskAi: () => set({ askAiOpen: true }),
  closeAskAi: () => set({ askAiOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setTheme: (theme) => {
    writeStoredTheme(theme);
    set({ theme });
  },
  setNoteTheme: (noteTheme) => {
    writeStoredNoteTheme(noteTheme);
    set({ noteTheme });
  },
  setLocale: (locale) => {
    writeStoredLocale(locale);
    set({ locale });
  },
}));
