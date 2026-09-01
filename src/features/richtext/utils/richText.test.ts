import { describe, expect, it } from "vitest";
import { isValidRichText, parseRichTextContent } from "./richText";

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
