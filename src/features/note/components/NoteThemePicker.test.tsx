import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NOTE_THEME_STORAGE_KEY, useUiStore } from "@/stores/ui.store";
import { NoteThemeOptions } from "./NoteThemePicker";

describe("NoteThemeOptions", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ noteTheme: "classic" });
  });

  it("展示八套笔记主题并切换持久化", () => {
    render(<NoteThemeOptions />);
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(8);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "森林" }));
    expect(useUiStore.getState().noteTheme).toBe("forest");
    expect(localStorage.getItem(NOTE_THEME_STORAGE_KEY)).toBe("forest");
  });

  it("可切换到新增的暗色系主题", () => {
    render(<NoteThemeOptions />);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "石墨" }));
    expect(useUiStore.getState().noteTheme).toBe("graphite");
  });
});
