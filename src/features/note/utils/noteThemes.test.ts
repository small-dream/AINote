import { describe, expect, it } from "vitest";
import { getNoteThemeMode, getNoteThemeOption, NOTE_THEME_OPTIONS } from "./noteThemes";

describe("noteThemes 主题注册表", () => {
  it("内置主题均标注明暗系且唯一", () => {
    const values = NOTE_THEME_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(NOTE_THEME_OPTIONS.length);
    for (const option of NOTE_THEME_OPTIONS) {
      expect(["light", "dark"]).toContain(option.mode);
      expect(option.swatches.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("getNoteThemeMode 返回主题对应明暗系", () => {
    expect(getNoteThemeMode("midnight")).toBe("dark");
    expect(getNoteThemeMode("classic")).toBe("light");
    expect(getNoteThemeMode("solar")).toBe("light");
    expect(getNoteThemeMode("graphite")).toBe("dark");
    expect(getNoteThemeMode("inkblue")).toBe("dark");
    expect(getNoteThemeMode("warmdark")).toBe("dark");
  });

  it("未知主题回退亮色，避免 dark 标志误判", () => {
    expect(getNoteThemeMode("unknown" as never)).toBe("light");
  });

  it("getNoteThemeOption 未知主题回退第一项", () => {
    expect(getNoteThemeOption("unknown" as never).value).toBe("classic");
    expect(getNoteThemeOption("paper").value).toBe("paper");
  });
});
