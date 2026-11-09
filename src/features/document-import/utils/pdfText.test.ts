import { describe, expect, it } from "vitest";
import {
  assemblePdfMarkdown,
  dedupeRepeatedMargins,
  isProbablyScanned,
  needsSpace,
  pageTextFromItems,
  type PdfTextItem,
} from "./pdfText";

function item(text: string, x: number, y: number, width = text.length * 10, height = 10): PdfTextItem {
  return { text, x, y, width, height };
}

describe("needsSpace", () => {
  it("中文相邻字符不加空格，拉丁文字需要空格", () => {
    expect(needsSpace("你", "好")).toBe(false);
    expect(needsSpace("中", "A")).toBe(true);
    expect(needsSpace("A", "中")).toBe(true);
    expect(needsSpace("a", "b")).toBe(true);
    expect(needsSpace("(", "a")).toBe(false);
    expect(needsSpace("a", "，")).toBe(false);
  });
});

describe("pageTextFromItems", () => {
  it("按坐标合并同一行并重建段落", () => {
    const text = pageTextFromItems([
      item("Hello", 0, 100, 20),
      item("world", 24, 100, 20),
      item("你好", 0, 80, 20),
      item("世界", 20, 80, 20),
    ]);
    expect(text).toBe("Hello world\n\n你好世界");
  });

  it("同一段落内英文行补空格，中文行直接拼接", () => {
    expect(pageTextFromItems([item("First line", 0, 100), item("Second line", 0, 90)])).toBe("First line Second line");
    expect(pageTextFromItems([item("第一行", 0, 100), item("第二行", 0, 90)])).toBe("第一行第二行");
  });

  it("行内中文相邻项不强行插空格", () => {
    expect(pageTextFromItems([item("中文", 0, 100, 20), item("排版", 20, 100, 20)])).toBe("中文排版");
  });
});

describe("dedupeRepeatedMargins", () => {
  it("移除多页重复的页眉与页码页脚", () => {
    const pages = [
      ["AINote 周报", "第一段", "第一段续", "第一段末", "第 1 页"].join("\n"),
      ["AINote 周报", "第二段", "第二段续", "第二段末", "第 2 页"].join("\n"),
      ["AINote 周报", "第三段", "第三段续", "第三段末", "第 3 页"].join("\n"),
    ];
    const cleaned = dedupeRepeatedMargins(pages);
    expect(cleaned[0]).toBe("第一段\n第一段续\n第一段末");
    expect(cleaned[1]).toBe("第二段\n第二段续\n第二段末");
    expect(cleaned[2]).toBe("第三段\n第三段续\n第三段末");
  });

  it("只有一页时原样返回", () => {
    expect(dedupeRepeatedMargins(["页眉\n正文\n页脚"])).toEqual(["页眉\n正文\n页脚"]);
  });

  it("短页面也能移除重复页眉页脚", () => {
    const cleaned = dedupeRepeatedMargins([
      ["报告", "正文一", "第 1 页"].join("\n"),
      ["报告", "正文二", "第 2 页"].join("\n"),
    ]);
    expect(cleaned).toEqual(["正文一", "正文二"]);
  });

  it("数字结构相同的正文不会被当作页眉页脚删除", () => {
    const pages = [
      ["2024 年收入 100", "第一季度", "2025 年利润 200"].join("\n"),
      ["2024 年收入 300", "第二季度", "2025 年利润 400"].join("\n"),
    ];
    expect(dedupeRepeatedMargins(pages)).toEqual(pages);
  });

  it("两行页面不执行边距清理，避免清空整页", () => {
    const pages = ["2024 年收入 100\n2025 年利润 200", "2024 年收入 300\n2025 年利润 400"];
    expect(dedupeRepeatedMargins(pages)).toEqual(pages);
  });

  it("即使候选行全部重复，也回退为原页面内容", () => {
    const pages = ["报告\n第 1 页\n报告", "报告\n第 2 页\n报告"];
    expect(dedupeRepeatedMargins(pages)).toEqual(pages);
  });

  it("去页眉页脚时保留页内段落分隔", () => {
    const pages = [
      ["页眉", "标题", "段落一第一行", "段落一第二行", "", "段落二", "第 1 页"].join("\n"),
      ["页眉", "标题", "第三段第一行", "第三段第二行", "", "第四段", "第 2 页"].join("\n"),
    ];
    expect(dedupeRepeatedMargins(pages)).toEqual([
      "段落一第一行\n段落一第二行\n\n段落二",
      "第三段第一行\n第三段第二行\n\n第四段",
    ]);
  });

  it("段落被页眉隔开时仍按块保留", () => {
    const pages = [
      ["共 2 页", "第一段", "", "第二段"].join("\n"),
      ["共 2 页", "第三段", "", "第四段"].join("\n"),
    ];
    expect(dedupeRepeatedMargins(pages)).toEqual(["第一段\n\n第二段", "第三段\n\n第四段"]);
    expect(assemblePdfMarkdown(dedupeRepeatedMargins(pages))).toBe("第一段\n\n第二段\n\n---\n\n第三段\n\n第四段");
  });
});

describe("assemblePdfMarkdown", () => {
  it("页间插入分隔线并过滤空白页", () => {
    expect(assemblePdfMarkdown(["第一页", "", "第二页"])).toBe("第一页\n\n---\n\n第二页");
  });
});

describe("isProbablyScanned", () => {
  it("半数以上页面没有文字时判定为疑似扫描件", () => {
    expect(isProbablyScanned(["", "  ", "有文字"])).toBe(true);
    expect(isProbablyScanned(["第一页有足够的正文内容", "第二页有足够的正文内容"])).toBe(false);
  });
});
