import { describe, expect, it, vi } from "vitest";
import { commandMatches, filterCommands, searchResultToCommand, type PaletteCommand } from "./palette";

const cmd = (id: string, label: string, keywords: string[] = []): PaletteCommand => ({
  id,
  label,
  keywords,
  run: () => {},
});

describe("commandMatches", () => {
  it("matches empty query for all", () => {
    expect(commandMatches(cmd("a", "新建笔记"), "")).toBe(true);
  });

  it("matches label case-insensitively", () => {
    expect(commandMatches(cmd("a", "Sync Now"), "sync")).toBe(true);
    expect(commandMatches(cmd("a", "Sync Now"), "SYNC NOW")).toBe(true);
  });

  it("matches keywords", () => {
    const c = cmd("a", "一键同步", ["sync", "push"]);
    expect(commandMatches(c, "push")).toBe(true);
    expect(commandMatches(c, "同步")).toBe(true);
  });

  it("rejects non-matching query", () => {
    expect(commandMatches(cmd("a", "新建笔记", ["note"]), "search")).toBe(false);
  });
});

describe("filterCommands", () => {
  it("returns all when query empty", () => {
    const commands = [cmd("a", "A"), cmd("b", "B")];
    expect(filterCommands(commands, "")).toHaveLength(2);
  });

  it("filters by label and keywords", () => {
    const commands = [cmd("a", "新建笔记", ["note"]), cmd("b", "Sync Now", ["同步"])];
    expect(filterCommands(commands, "sync").map((c) => c.id)).toEqual(["b"]);
    expect(filterCommands(commands, "note").map((c) => c.id)).toEqual(["a"]);
  });
});

describe("searchResultToCommand", () => {
  it("包装为打开笔记命令并携带路径 hint", () => {
    const onOpenNote = vi.fn();
    const close = vi.fn();
    const cmd = searchResultToCommand(
      { path: "daily/a.md", title: "A", snippet: "ctx", line: 1, updatedAt: 1 },
      onOpenNote,
      close,
    );
    expect(cmd.label).toBe("A");
    expect(cmd.hint).toBe("daily/a.md");
    cmd.run();
    expect(onOpenNote).toHaveBeenCalledWith("daily/a.md");
    expect(close).toHaveBeenCalled();
  });
});
