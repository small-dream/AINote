import { describe, expect, it } from "vitest";
import { appendLine, splitLines } from "./merge";

describe("splitLines", () => {
  it("按换行拆分", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
    expect(splitLines("单行")).toEqual(["单行"]);
    expect(splitLines("")).toEqual([""]);
  });
});

describe("appendLine", () => {
  it("追加到末尾，空文本作首行，空行忽略", () => {
    expect(appendLine("", "a")).toBe("a");
    expect(appendLine("a", "b")).toBe("a\nb");
    expect(appendLine("a", "")).toBe("a");
  });
});
