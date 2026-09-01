import { describe, expect, it } from "vitest";
import { parseMarkdownTable } from "./table";

describe("parseMarkdownTable", () => {
  it("解析表头与数据行，跳过分隔行", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    expect(parseMarkdownTable(source)).toEqual({
      header: ["a", "b"],
      rows: [["1", "2"], ["3", "4"]],
      align: [null, null],
    });
  });

  it("支持对齐分隔符与无首尾竖线写法", () => {
    const source = "a | b\n:- | -:\n1 | 2";
    expect(parseMarkdownTable(source)).toEqual({
      header: ["a", "b"],
      rows: [["1", "2"]],
      align: ["left", "right"],
    });
  });

  it("处理转义竖线与单元格内代码", () => {
    const source = "| a \\| b | `x | y` |\n| --- | --- |\n| 1 | 2 |";
    const parsed = parseMarkdownTable(source);
    expect(parsed?.header).toEqual(["a | b", "`x | y`"]);
    expect(parsed?.rows[0]).toEqual(["1", "2"]);
  });

  it("居中对齐", () => {
    const source = "| a | b |\n| :-: | :-: |\n| 1 | 2 |";
    expect(parseMarkdownTable(source)?.align).toEqual(["center", "center"]);
  });

  it("少于两行或空表头返回 null", () => {
    expect(parseMarkdownTable("| a |")).toBeNull();
    expect(parseMarkdownTable("| --- |\n| 1 |")).toBeNull();
  });
});
