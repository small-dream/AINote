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

  it("CRLF frontmatter 写入后保持换行风格且不重复分隔线", () => {
    const original = "---\r\ntitle: 标题\r\naliases:\r\n  - 旧名\r\n---\r\n\r\n正文";
    const added = addMarkdownAlias(original, "新名");
    expect(added).toContain("title: 标题\r\n");
    expect(added.match(/^---\r?$/gm)).toHaveLength(2);
    expect(parseMarkdownAliases(added)).toEqual(["旧名", "新名"]);
    expect(added.endsWith("正文")).toBe(true);

    const removed = removeMarkdownAlias(added, "旧名");
    expect(removed.match(/^---\r?$/gm)).toHaveLength(2);
    expect(parseMarkdownAliases(removed)).toEqual(["新名"]);
  });

  it("损坏的 frontmatter 不抛异常且写操作保持原文", () => {
    const broken = "---\ntitle: [未闭合\n---\n\n正文";
    expect(() => parseMarkdownAliases(broken)).not.toThrow();
    expect(parseMarkdownAliases(broken)).toEqual([]);
    expect(addMarkdownAlias(broken, "别名")).toBe(broken);
    expect(removeMarkdownAlias(broken, "别名")).toBe(broken);
  });
});
