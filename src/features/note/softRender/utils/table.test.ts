import { describe, expect, it } from "vitest";
import { escapeCell, parseMarkdownTable, serializeMarkdownTable } from "./table";

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

describe("serializeMarkdownTable", () => {
  it("序列化后与解析结果互逆（round-trip）", () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const parsed = parseMarkdownTable(source);
    if (!parsed) throw new Error("expected parsed table");
    const serialized = serializeMarkdownTable(parsed);
    expect(parseMarkdownTable(serialized)).toEqual(parsed);
  });

  it("保留对齐语法（左/右/居中/默认）", () => {
    const source = "| a | b | c | d |\n| :--- | ---: | :---: | --- |\n| 1 | 2 | 3 | 4 |";
    const parsed = parseMarkdownTable(source);
    if (!parsed) throw new Error("expected parsed table");
    const serialized = serializeMarkdownTable(parsed);
    expect(serialized).toContain("| :--- | ---: | :---: | --- |");
    expect(parseMarkdownTable(serialized)).toEqual(parsed);
  });

  it("单元格含竖线时转义并可解析回原值", () => {
    const serialized = serializeMarkdownTable({ header: ["a | b", "c"], rows: [["x", "y"]], align: [null, null] });
    expect(serialized).toContain("a \\| b");
    const parsed = parseMarkdownTable(serialized);
    expect(parsed?.header).toEqual(["a | b", "c"]);
    expect(parsed?.rows[0]).toEqual(["x", "y"]);
  });

  it("空表格与单行表格仍输出合法分隔行", () => {
    expect(serializeMarkdownTable({ header: ["h"], rows: [], align: [null] })).toBe("| h |\n| --- |");
    expect(serializeMarkdownTable({ header: ["h"], rows: [["1"]], align: [null] })).toBe("| h |\n| --- |\n| 1 |");
  });
});

describe("escapeCell", () => {
  it("转义反斜杠与竖线", () => {
    expect(escapeCell("a|b")).toBe("a\\|b");
    expect(escapeCell("a\\b")).toBe("a\\\\b");
    expect(escapeCell("plain")).toBe("plain");
  });
});
