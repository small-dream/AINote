import { describe, expect, it } from "vitest";
import { extractTitle, extractWikiLinks, findTitleCursorIndex } from "./markdown";

describe("extractTitle", () => {
  it("取第一个 ATX 标题", () => {
    expect(extractTitle("前言\n# 我的标题\n正文", "fallback.md")).toBe("我的标题");
  });

  it("无标题时回退到文件名", () => {
    expect(extractTitle("没有标题的正文", "fallback.md")).toBe("fallback.md");
  });

  it("空内容返回回退值", () => {
    expect(extractTitle("", "a.md")).toBe("a.md");
  });
});

describe("extractWikiLinks", () => {
  it("提取双链目标", () => {
    expect(extractWikiLinks("见 [[笔记A]] 和 [[笔记B|别名]]")).toEqual(["笔记A", "笔记B"]);
  });

  it("无双链返回空数组", () => {
    expect(extractWikiLinks("普通 [链接](url)")).toEqual([]);
  });
});

describe("findTitleCursorIndex", () => {
  it("首行是标题时返回标题文字起点", () => {
    expect(findTitleCursorIndex("# 我的笔记\n正文")).toBe(2);
  });

  it("无标题时返回 0", () => {
    expect(findTitleCursorIndex("直接正文")).toBe(0);
    expect(findTitleCursorIndex("")).toBe(0);
  });
});
