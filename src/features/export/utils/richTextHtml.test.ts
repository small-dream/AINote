import { describe, expect, it } from "vitest";
import { richTextJsonToHtml } from "./richTextHtml";

function doc(nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

describe("richTextJsonToHtml", () => {
  it("标题与段落序列化为 HTML", () => {
    const json = doc([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题" }] },
      { type: "paragraph", content: [{ type: "text", text: "正文" }] },
    ]);
    const html = richTextJsonToHtml(json, null);
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<p>正文</p>");
  });

  it("保留双链与标签原文标记", () => {
    const json = doc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "见 [[目标]] 与 #标签" }],
      },
    ]);
    const html = richTextJsonToHtml(json, null);
    expect(html).toContain("[[目标]]");
    expect(html).toContain("#标签");
  });

  it("空内容与非法 JSON 返回空字符串", () => {
    expect(richTextJsonToHtml("", null)).toBe("");
    expect(richTextJsonToHtml("not json", null)).toBe("");
  });

  it("列表与代码块可序列化", () => {
    const json = doc([
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "项" }] }] }] },
      { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] },
    ]);
    const html = richTextJsonToHtml(json, null);
    expect(html).toContain("<li>");
    expect(html).toContain("language-ts");
    expect(html).toContain("const x = 1;");
  });
});
