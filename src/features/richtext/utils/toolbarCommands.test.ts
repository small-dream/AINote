import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { HEADING_COMMANDS, getActiveHeadingCommand } from "./toolbarCommands";

/** 只回答「当前是否是某个级别标题」的最简编辑器替身：不传 attrs 表示「任意级别的该类型」。 */
function editorAt(activeType: string, level?: number): Editor {
  return {
    isActive: vi.fn((type: string, attrs?: { level?: number }) => type === activeType && (attrs?.level === undefined || attrs.level === level)),
  } as unknown as Editor;
}

describe("HEADING_COMMANDS", () => {
  it("覆盖正文与 H1-H6，与 Markdown 标题级别口径一致", () => {
    expect(HEADING_COMMANDS.map((command) => command.key)).toEqual(["paragraph", "h1", "h2", "h3", "h4", "h5", "h6"]);
  });

  it("每个标题命令只在自己级别下激活", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const command = HEADING_COMMANDS.find((item) => item.key === `h${level}`);
      expect(command?.isActive?.(editorAt("heading", level))).toBe(true);
      expect(command?.isActive?.(editorAt("heading", level === 6 ? 5 : 6))).toBe(false);
    }
    expect(HEADING_COMMANDS[0]?.isActive?.(editorAt("paragraph"))).toBe(true);
    expect(HEADING_COMMANDS[0]?.isActive?.(editorAt("heading", 6))).toBe(false);
  });
});

describe("getActiveHeadingCommand", () => {
  it("光标位于 H4-H6 时返回对应命令，而不是正文", () => {
    for (const level of [4, 5, 6]) {
      expect(getActiveHeadingCommand(editorAt("heading", level)).key).toBe(`h${level}`);
    }
  });

  it("非标题段落返回正文", () => {
    expect(getActiveHeadingCommand(editorAt("paragraph")).key).toBe("paragraph");
  });
});
