import { describe, expect, it } from "vitest";
import { remarkMarkdownTags } from "./markdownTags";

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

function tagNode(tag: string): MarkdownNode {
  return {
    type: "emphasis",
    data: { hName: "em", hProperties: { "data-tag": tag } },
    children: [{ type: "text", value: tag }],
  };
}

function paragraphWithText(value: string): MarkdownNode {
  return { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value }] }] };
}

function transform(tree: MarkdownNode): MarkdownNode[] {
  remarkMarkdownTags()(tree);
  return tree.children?.[0]?.children ?? [];
}

describe("remarkMarkdownTags 行内 #标签 提取", () => {
  it("正文中间的标签转为带 data-tag 的 emphasis 节点", () => {
    expect(transform(paragraphWithText("参考 #前端 的内容"))).toEqual([
      { type: "text", value: "参考" },
      tagNode("前端"),
      { type: "text", value: " 的内容" },
    ]);
  });

  it("行首标签无需前置空白即可命中", () => {
    expect(transform(paragraphWithText("#标签 正文"))).toEqual([
      tagNode("标签"),
      { type: "text", value: " 正文" },
    ]);
  });

  it("同一文本节点可提取多个标签", () => {
    expect(transform(paragraphWithText("#a 和 #b"))).toEqual([
      tagNode("a"),
      { type: "text", value: " 和" },
      tagNode("b"),
    ]);
  });

  it("中文标点（，。、；）是合法边界：前置可命中、后置截断标签", () => {
    expect(transform(paragraphWithText("笔记，#标签。后续"))).toEqual([
      { type: "text", value: "笔记" },
      tagNode("标签"),
      { type: "text", value: "。后续" },
    ]);
    expect(transform(paragraphWithText("项目、#bug；收尾"))).toEqual([
      { type: "text", value: "项目" },
      tagNode("bug"),
      { type: "text", value: "；收尾" },
    ]);
  });
});

describe("remarkMarkdownTags 不命中边界", () => {
  it("标题写法「# 标题」（# 后紧跟空白）不识别为标签", () => {
    expect(transform(paragraphWithText("# 标题"))).toEqual([{ type: "text", value: "# 标题" }]);
  });

  it("标签内部含 # 时只命中第一段", () => {
    expect(transform(paragraphWithText("#a#b"))).toEqual([
      tagNode("a"),
      { type: "text", value: "#b" },
    ]);
  });

  it("前贴英文/数字字符（无空白边界）不命中", () => {
    expect(transform(paragraphWithText("email#tag C#"))).toEqual([
      { type: "text", value: "email#tag C#" },
    ]);
  });

  it("code 与 inlineCode 子树不提取标签", () => {
    const tree: MarkdownNode = {
      type: "root",
      children: [
        { type: "code", value: "#注释", children: [{ type: "text", value: "#注释" }] },
        {
          type: "paragraph",
          children: [{ type: "inlineCode", value: "#tag", children: [{ type: "text", value: "#tag" }] }],
        },
      ],
    };
    remarkMarkdownTags()(tree);

    expect(tree.children?.[0]?.children).toEqual([{ type: "text", value: "#注释" }]);
    expect(tree.children?.[1]?.children).toEqual([
      { type: "inlineCode", value: "#tag", children: [{ type: "text", value: "#tag" }] },
    ]);
  });
});

describe("remarkMarkdownTags AST 遍历", () => {
  it("递归处理嵌套容器（引用块内的段落）", () => {
    const tree: MarkdownNode = {
      type: "root",
      children: [
        {
          type: "blockquote",
          children: [{ type: "paragraph", children: [{ type: "text", value: "引用里 #嵌套" }] }],
        },
      ],
    };
    remarkMarkdownTags()(tree);

    expect(tree.children?.[0]?.children?.[0]?.children).toEqual([
      { type: "text", value: "引用里" },
      tagNode("嵌套"),
    ]);
  });

  it("非 text 节点原样保留，无标签文本不被拆分", () => {
    const tree: MarkdownNode = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "strong", children: [{ type: "text", value: "加粗" }] },
            { type: "text", value: "没有标签" },
          ],
        },
      ],
    };
    remarkMarkdownTags()(tree);

    expect(tree.children?.[0]?.children).toEqual([
      { type: "strong", children: [{ type: "text", value: "加粗" }] },
      { type: "text", value: "没有标签" },
    ]);
  });
});
