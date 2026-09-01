import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY, NOTE_THEME_STORAGE_KEY, parseLocale, parseNoteTheme, parseTheme, readStoredLocale, readStoredTheme, THEME_STORAGE_KEY, useUiStore } from "./ui.store";

describe("ui.store 主题解析与持久化", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => useUiStore.setState({ theme: "light", noteTheme: "classic", locale: "zh-CN" }));

  it("parseTheme 非法值回退亮色", () => {
    expect(parseTheme("dark")).toBe("dark");
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
    expect(parseNoteTheme("unknown")).toBe("classic");
    useUiStore.getState().setNoteTheme("midnight");
    expect(localStorage.getItem(NOTE_THEME_STORAGE_KEY)).toBe("midnight");
  });
});
