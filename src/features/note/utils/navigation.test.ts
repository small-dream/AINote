import { describe, expect, it } from "vitest";
import { citationQuote, findMarkdownHeadingLine, markdownNavigationLine } from "./navigation";

describe("note navigation", () => {
  it("explicit line wins and heading lookup ignores fences", () => {
    const markdown = "# 标题\n```\n## 代码\n```\n## 目标";
    expect(findMarkdownHeadingLine(markdown, "目标")).toBe(5);
    expect(markdownNavigationLine(markdown, { path: "a.md", line: 2, heading: "目标" })).toBe(2);
    expect(markdownNavigationLine(markdown, { path: "a.md", heading: "目标" })).toBe(5);
  });

  it("extracts the first matchable non-empty citation line", () => {
    expect(citationQuote("\n# 最近标题\n正文 **加粗** [链接](https://x)")).toBe("最近标题");
    expect(citationQuote("\n\n- 项目计划 (P0)")).toBe("项目计划 (P0)");
    expect(citationQuote("   ")).toBeNull();
  });
});
