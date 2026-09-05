import { describe, expect, it } from "vitest";
import { applyRichTextTitle, isValidRichText, parseRichTextContent } from "./richText";

describe("parseRichTextContent", () => {
  it("解析合法 TipTap JSON 文档", () => {
    const doc = parseRichTextContent('{"type":"doc","content":[{"type":"paragraph"}]}');
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
  });

  it("非法 JSON 回退为空段落文档", () => {
    const doc = parseRichTextContent("not json");
    expect(doc.type).toBe("doc");
    expect(doc.content).toEqual([{ type: "paragraph" }]);
  });

  it("空内容回退为空段落文档", () => {
    const doc = parseRichTextContent("");
    expect(doc.type).toBe("doc");
    expect(doc.content).toEqual([{ type: "paragraph" }]);
  });

  it("非 doc 根类型回退为空段落文档", () => {
    expect(parseRichTextContent('{"type":"other"}').type).toBe("doc");
  });
});

describe("applyRichTextTitle", () => {
  it("替换首个一级标题", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "旧" }] },
        { type: "paragraph" },
      ],
    });
    const next = JSON.parse(applyRichTextTitle(content, "新标题"));
    expect(next.content[0].content[0].text).toBe("新标题");
  });

  it("没有一级标题时插入标题", () => {
    const content = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    const next = JSON.parse(applyRichTextTitle(content, "标题"));
    expect(next.content[0].type).toBe("heading");
    expect(next.content[0].attrs.level).toBe(1);
    expect(next.content[0].content[0].text).toBe("标题");
  });
});

describe("isValidRichText", () => {
  it("合法文档返回 true", () => {
    expect(isValidRichText('{"type":"doc","content":[]}')).toBe(true);
  });

  it("非法输入返回 false", () => {
    expect(isValidRichText("")).toBe(false);
    expect(isValidRichText('{"type":"x"}')).toBe(false);
    expect(isValidRichText("[]")).toBe(false);
  });
});
