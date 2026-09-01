import { describe, expect, it } from "vitest";
import { markdownToRichTextJson } from "./markdownConversion";

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
