import { describe, expect, it } from "vitest";
import { countCharacters, positionAt, statsAt } from "./editorStats";

describe("editorStats", () => {
  it("按去掉空白后的 Unicode 字符计字", () => {
    expect(countCharacters("你好 world\n")).toBe(7);
    expect(countCharacters("  \n\t")).toBe(0);
    expect(countCharacters("👋🏽 a")).toBe(2);
  });

  it("把 offset 转成 1 起行列", () => {
    expect(positionAt("abc", 0)).toEqual({ line: 1, column: 1 });
    expect(positionAt("a\nbc\n", 3)).toEqual({ line: 2, column: 2 });
    expect(positionAt("a\nbc\n", 5)).toEqual({ line: 3, column: 1 });
  });

  it("CRLF 只算一次换行并夹紧越界 offset", () => {
    expect(positionAt("a\r\nbc", 4)).toEqual({ line: 2, column: 2 });
    expect(positionAt("abc", 99)).toEqual({ line: 1, column: 4 });
  });

  it("同时返回字数与位置", () => {
    expect(statsAt("一 二\n三", 5)).toEqual({ characters: 3, line: 2, column: 2 });
  });
});
