import { describe, expect, it } from "vitest";
import { applyTitleToMarkdown, cleanTitleCandidate, parseTitleSuggestions } from "./titles";

describe("cleanTitleCandidate", () => {
  it("去除行首序号", () => {
    expect(cleanTitleCandidate("1. 第一个标题")).toBe("第一个标题");
    expect(cleanTitleCandidate("2、第二个标题")).toBe("第二个标题");
    expect(cleanTitleCandidate("3) 第三个")).toBe("第三个");
  });

  it("去除列表符号与引号", () => {
    expect(cleanTitleCandidate("- 列表标题")).toBe("列表标题");
    expect(cleanTitleCandidate("「加引号标题」")).toBe("加引号标题");
    expect(cleanTitleCandidate('"双引号"')).toBe("双引号");
  });
});

describe("parseTitleSuggestions", () => {
  it("解析每行候选并清洗", () => {
    const titles = parseTitleSuggestions("1. 标题甲\n2. 标题乙\n标题丙");
    expect(titles).toEqual(["标题甲", "标题乙", "标题丙"]);
  });

  it("过滤空行与重复", () => {
    const titles = parseTitleSuggestions("标题甲\n\n标题甲\n标题乙");
    expect(titles).toEqual(["标题甲", "标题乙"]);
  });

  it("空文本返回空数组", () => {
    expect(parseTitleSuggestions("  \n\n")).toEqual([]);
  });
});

describe("applyTitleToMarkdown", () => {
  it("替换首个一级标题", () => {
    const out = applyTitleToMarkdown("# 旧标题\n\n正文", "新标题");
    expect(out).toBe("# 新标题\n\n正文");
  });

  it("无标题时在文首插入", () => {
    const out = applyTitleToMarkdown("正文内容", "新标题");
    expect(out.startsWith("# 新标题\n\n正文内容")).toBe(true);
  });
});
