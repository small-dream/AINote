import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { describe, expect, it } from "vitest";
import { parseMarkdownDocument, remarkCallouts, remarkRemoveFrontmatter } from "./markdownPipeline";

describe("markdown pipeline", () => {
  it("解析顶层 YAML 属性并过滤复杂值", () => {
    expect(parseMarkdownDocument("---\ntitle: Demo\ntags: [a, b]\nmeta:\n  x: 1\n---\n正文").frontmatter)
      .toEqual([{ key: "title", value: "Demo" }, { key: "tags", value: "a, b" }]);
  });

  it("无效 frontmatter 不影响正文", () => {
    expect(parseMarkdownDocument("---\ntitle: [\n---\n正文").frontmatter).toEqual([]);
  });

  it("将 callout 标记为 data-callout 并移除语法前缀", () => {
    const tree = unified().use(remarkParse).parse("> [!WARNING] 小心\n> 内容");
    unified().use(remarkCallouts).runSync(tree);
    const blockquote = tree.children[0] as { data?: { hProperties?: Record<string, string> }; children: Array<{ type: string; children?: Array<{ value?: string }> }> };
    expect(blockquote.data?.hProperties?.["data-callout"]).toBe("warning");
    expect(blockquote.children[0]?.children?.[0]?.value).toBe("小心\n内容");
  });

  it("移除 frontmatter AST 节点", () => {
    const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).parse("---\ntitle: Demo\n---\n正文");
    unified().use(remarkRemoveFrontmatter).runSync(tree);
    expect(tree.children.some((node) => node.type === "yaml")).toBe(false);
  });
});
