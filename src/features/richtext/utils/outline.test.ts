import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { extractRichTextOutline } from "./outline";

describe("extractRichTextOutline 基础", () => {
  it("提取各级标题并记录层级与序号", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题一" }] },
        { type: "paragraph", content: [{ type: "text", text: "正文" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "标题二" }] },
      ],
    };
    const items = extractRichTextOutline(doc);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ text: "标题一", level: 1, line: 0 });
    expect(items[1]).toMatchObject({ text: "标题二", level: 2, line: 1 });
  });
});

describe("extractRichTextOutline 文本", () => {
  it("拼接标题内带行内标记的文本", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "粗体", marks: [{ type: "bold" }] }],
        },
      ],
    };
    expect(extractRichTextOutline(doc)).toMatchObject([{ text: "粗体", level: 3 }]);
  });
});

describe("extractRichTextOutline 过滤", () => {
  it("忽略非标题节点与嵌套文档", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "正文" }] },
        {
          type: "blockquote",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "引用里的标题" }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "text", text: "列表" }] }] },
      ],
    };
    const items = extractRichTextOutline(doc);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "引用里的标题" });
  });
});

describe("extractRichTextOutline 边界", () => {
  it("重复标题生成唯一 id", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "重复" }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "重复" }] },
      ],
    };
    const [first, second] = extractRichTextOutline(doc);
    expect(first?.id).toBeDefined();
    expect(second?.id).not.toBe(first?.id);
  });

  it("空文档返回空列表", () => {
    expect(extractRichTextOutline({ type: "doc" })).toEqual([]);
  });
});
