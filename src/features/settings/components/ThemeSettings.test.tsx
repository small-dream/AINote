import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, useUiStore } from "@/stores/ui.store";
import { ThemeSettings } from "./ThemeSettings";

describe("ThemeSettings 主题切换", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ theme: "light" });
  });

  it("渲染亮色 / 暗色 / 跟随系统三个选项", () => {
    render(<ThemeSettings />);
    expect(screen.getByText("亮色")).toBeTruthy();
    expect(screen.getByText("暗色")).toBeTruthy();
    expect(screen.getByText("跟随系统")).toBeTruthy();
  });

  it("当前主题高亮对应选项", () => {
    render(<ThemeSettings />);
    expect(screen.getByRole("radio", { name: "亮色" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "暗色" }).getAttribute("aria-checked")).toBe("false");
  });

  it("点击暗色切换主题并持久化", () => {
    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole("radio", { name: "暗色" }));
    expect(useUiStore.getState().theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "暗色" }).getAttribute("aria-checked")).toBe("true");
  });

  it("点击跟随系统切换并持久化", () => {
    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole("radio", { name: "跟随系统" }));
    expect(useUiStore.getState().theme).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("阅读主题画廊展示八套主题并支持切换", () => {
    render(<ThemeSettings />);
    const cards = screen.getAllByRole("button", { pressed: false }).filter((node) => node.className.includes("overflow-hidden rounded-lg border"));
    expect(cards.length).toBeGreaterThanOrEqual(7);
    fireEvent.click(screen.getByText("石墨"));
    expect(useUiStore.getState().noteTheme).toBe("graphite");
  });
});
