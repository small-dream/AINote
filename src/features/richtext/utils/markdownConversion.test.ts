import { describe, expect, it } from "vitest";
import { markdownToRichTextJson, richTextJsonToMarkdown } from "./markdownConversion";

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
}

function parse(content: string): JsonNode {
  return JSON.parse(markdownToRichTextJson(content)) as JsonNode;
}

describe("markdownToRichTextJson", () => {
  it("把标题与段落转为 TipTap JSON", () => {
    const doc = parse("# 标题\n\n正文段落");
    expect(doc.type).toBe("doc");
    expect(doc.content?.[0]?.type).toBe("heading");
    expect(doc.content?.[0]?.attrs?.level).toBe(1);
    expect(doc.content?.[1]?.type).toBe("paragraph");
  });

  it("解析无序列表", () => {
    const doc = parse("- 甲\n- 乙");
    expect(doc.content?.[0]?.type).toBe("bulletList");
    expect(doc.content?.[0]?.content).toHaveLength(2);
  });

  it("空内容仍返回合法 doc", () => {
    const doc = parse("");
    expect(doc.type).toBe("doc");
  });
});

describe("richTextJsonToMarkdown", () => {
  it("把 TipTap JSON 序列化为 Markdown", () => {
    const markdown = richTextJsonToMarkdown(markdownToRichTextJson("# 标题\n\n正文段落"));

    expect(markdown).toContain("# 标题");
    expect(markdown).toContain("正文段落");
  });

  it("非法 JSON 兜底为空文档", () => {
    expect(richTextJsonToMarkdown("not-json").trim()).toBe("");
  });

  it("双链与标签 md → JSON → md 完整往返，无 span 噪音", () => {
    const source = "见 [[项目计划]] 与 [[A|别名]]，以及 #bug 和 #项目/子页";
    const roundTripped = richTextJsonToMarkdown(markdownToRichTextJson(source));

    expect(roundTripped).toContain("[[项目计划]]");
    expect(roundTripped).toContain("[[A|别名]]");
    expect(roundTripped).toContain("#bug");
    expect(roundTripped).toContain("#项目/子页");
    expect(roundTripped).not.toContain("data-wiki-target");
    expect(roundTripped).not.toContain("data-tag");
    expect(roundTripped).not.toContain("<span");
  });
});
