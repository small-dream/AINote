import { describe, expect, it } from "vitest";
import { richTextJsonToHtml, sanitizeRichTextHtml } from "./richTextHtml";

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

describe("richTextJsonToHtml 链接协议过滤（P2-1）", () => {
  it("危险协议链接剥离 href 但保留文本", () => {
    const json = doc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "点我", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
      },
    ]);
    const html = richTextJsonToHtml(json, null);
    expect(html).toContain("点我");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="javascript');
  });

  it("正常链接与图片 src 保留", () => {
    const json = doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "官网", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
          { type: "text", text: "邮件", marks: [{ type: "link", attrs: { href: "mailto:a@b.com" } }] },
          { type: "text", text: "相对", marks: [{ type: "link", attrs: { href: "assets/readme.md" } }] },
        ],
      },
      { type: "image", attrs: { src: "asset://localhost/repo/assets/x.png", alt: "x" } },
    ]);
    const html = richTextJsonToHtml(json, null);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@b.com"');
    expect(html).toContain('href="assets/readme.md"');
    expect(html).toContain('src="asset://localhost/repo/assets/x.png"');
  });
});

describe("sanitizeRichTextHtml", () => {
  it("剥离 javascript:/data:/vbscript: 属性", () => {
    const html = sanitizeRichTextHtml(
      '<p><a href="javascript:alert(1)">a</a><a href="data:text/html,<script>1</script>">b</a><img src="vbscript:msgbox(1)"><img src="data:image/png;base64,xx"></p>',
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("vbscript:");
    expect(html).not.toContain("data:");
    expect(html).toContain(">a</a>");
    expect(html).toContain("<img>");
  });

  it("混淆形式（大小写 / 实体编码 / 内嵌控制字符）同样剥离", () => {
    const html = sanitizeRichTextHtml(
      '<a href="JaVaScRiPt:alert(1)">a</a><a href="javascript&#58;alert(1)">b</a><a href="java\tscript:alert(1)">c</a>',
    );
    expect(html).not.toContain("href");
  });

  it("锚点与空值保留，其余结构不动", () => {
    const html = sanitizeRichTextHtml('<h1 id="t">标题</h1><a href="#section">锚</a>');
    expect(html).toContain('id="t"');
    expect(html).toContain('href="#section"');
  });

  it("空输入原样返回", () => {
    expect(sanitizeRichTextHtml("")).toBe("");
  });
});
