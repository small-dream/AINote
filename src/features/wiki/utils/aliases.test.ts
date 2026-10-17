import { describe, expect, it } from "vitest";
import { addMarkdownAlias, parseMarkdownAliases, removeMarkdownAlias } from "./aliases";

describe("wiki aliases frontmatter", () => {
  it("解析内联与块列表 aliases", () => {
    expect(parseMarkdownAliases("---\naliases: [计划, Plan]\n---\n正文")).toEqual(["计划", "Plan"]);
    expect(parseMarkdownAliases("---\naliases:\n  - 项目\n---\n正文")).toEqual(["项目"]);
  });

  it("新增与移除时保留正文和其他字段", () => {
    const added = addMarkdownAlias("---\ntitle: 标题\n---\n\n正文", "别名");
    expect(added).toContain("title: 标题");
    expect(parseMarkdownAliases(added)).toEqual(["别名"]);
    expect(added.endsWith("正文")).toBe(true);
    const removed = removeMarkdownAlias(added, "别名");
    expect(removed).not.toContain("aliases:");
    expect(removed).toContain("正文");
  });
});
