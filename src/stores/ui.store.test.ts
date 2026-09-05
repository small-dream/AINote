import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LOCALE_STORAGE_KEY,
  NOTE_THEME_STORAGE_KEY,
  NOTE_THEME_SCOPE_STORAGE_KEY,
  RECENT_NOTES_STORAGE_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  THEME_STORAGE_KEY,
  parseLocale,
  parseNoteTheme,
  parseNoteThemeScope,
  parseSidebarWidth,
  parseTheme,
  readStoredLocale,
  readStoredSidebarWidth,
  readStoredRecentNotes,
  readStoredTheme,
  resolveTheme,
  useUiStore,
} from "./ui.store";

afterEach(() => useUiStore.setState({ theme: "light", noteTheme: "classic", noteThemeScope: "workspace", locale: "zh-CN", sidebarWidth: SIDEBAR_DEFAULT_WIDTH, sidebarTab: "tree", focusedTag: null }));

describe("ui.store 主题解析与持久化", () => {
  beforeEach(() => localStorage.clear());

  it("parseTheme 非法值回退亮色", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme("unknown")).toBe("light");
  });

  it("setTheme 更新 store 并写入 localStorage", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("readStoredTheme 读取已持久化偏好", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("无持久化偏好时默认亮色", () => {
    expect(readStoredTheme()).toBe("light");
  });

  it("解析并持久化显示语言", () => {
    expect(parseLocale("en-US")).toBe("en-US");
    expect(parseLocale("unknown")).toBe("zh-CN");
    useUiStore.getState().setLocale("en-US");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en-US");
    expect(readStoredLocale()).toBe("en-US");
  });

  it("解析并持久化笔记主题", () => {
    expect(parseNoteTheme("forest")).toBe("forest");
    expect(parseNoteTheme("solar")).toBe("solar");
    expect(parseNoteTheme("graphite")).toBe("graphite");
    expect(parseNoteTheme("inkblue")).toBe("inkblue");
    expect(parseNoteTheme("warmdark")).toBe("warmdark");
    expect(parseNoteTheme("unknown")).toBe("classic");
    useUiStore.getState().setNoteTheme("midnight");
    expect(localStorage.getItem(NOTE_THEME_STORAGE_KEY)).toBe("midnight");
  });

  it("解析并持久化阅读主题作用范围", () => {
    expect(parseNoteThemeScope("content")).toBe("content");
    expect(parseNoteThemeScope("unknown")).toBe("workspace");
    useUiStore.getState().setNoteThemeScope("content");
    expect(useUiStore.getState().noteThemeScope).toBe("content");
    expect(localStorage.getItem(NOTE_THEME_SCOPE_STORAGE_KEY)).toBe("content");
  });
});

describe("ui.store 侧边栏 Tab 与标签聚焦", () => {
  it("setSidebarTab 切换侧边栏 Tab", () => {
    useUiStore.getState().setSidebarTab("tags");
    expect(useUiStore.getState().sidebarTab).toBe("tags");
  });

  it("openTagIndex 切到标签 Tab 并聚焦标签", () => {
    useUiStore.getState().openTagIndex("project");
    expect(useUiStore.getState().sidebarTab).toBe("tags");
    expect(useUiStore.getState().focusedTag).toBe("project");
  });
});

describe("ui.store 目录栏宽度", () => {
  beforeEach(() => localStorage.clear());

  it("解析非法或超界宽度并回退到默认/边界值", () => {
    expect(parseSidebarWidth(null)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(parseSidebarWidth("invalid")).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(parseSidebarWidth("160")).toBe(200);
    expect(parseSidebarWidth("640")).toBe(480);
  });

  it("读取并更新可持久化的目录栏宽度", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "360");
    expect(readStoredSidebarWidth()).toBe(360);

    useUiStore.getState().setSidebarWidth(1600);
    expect(useUiStore.getState().sidebarWidth).toBe(480);

    useUiStore.getState().persistSidebarWidth();
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("480");
  });
});

describe("ui.store 最近打开记录", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ recentNotes: {} });
  });

  afterEach(() => useUiStore.setState({ recentNotes: {} }));

  it("按仓库记录最近笔记、去重、限制数量并持久化", () => {
    const store = useUiStore.getState();
    store.recordRecentNote("/repo", "a.md");
    store.recordRecentNote("/repo", "b.md");
    store.recordRecentNote("/repo", "a.md");
    store.recordRecentNote("/other", "c.md");

    expect((useUiStore.getState().recentNotes["/repo"] ?? []).map((entry) => entry.path)).toEqual(["a.md", "b.md"]);
    expect(JSON.parse(localStorage.getItem(RECENT_NOTES_STORAGE_KEY) ?? "{}")).toMatchObject({
      "/repo": [{ path: "a.md" }, { path: "b.md" }],
      "/other": [{ path: "c.md" }],
    });
  });

  it("解析非法最近记录时回退为空对象", () => {
    localStorage.setItem(RECENT_NOTES_STORAGE_KEY, "{invalid");
    expect(readStoredRecentNotes()).toEqual({});
  });

  it("清除指定仓库的最近记录并保留其他仓库", () => {
    useUiStore.setState({
      recentNotes: {
        "/repo": [{ path: "a.md", openedAt: 1 }],
        "/other": [{ path: "b.md", openedAt: 2 }],
      },
    });
    useUiStore.getState().clearRecentNotes("/repo");
    expect(useUiStore.getState().recentNotes).toEqual({ "/other": [{ path: "b.md", openedAt: 2 }] });
  });
});

describe("ui.store 跟随系统解析", () => {
  it("resolveTheme 按主题与系统明暗解析实际值", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
