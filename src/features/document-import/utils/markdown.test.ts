import { describe, expect, it } from "vitest";
import { htmlToMarkdown, isSafeHref } from "./markdown";

describe("htmlToMarkdown", () => {
  it("保留标题、段落、列表、表格、链接与强调", () => {
    const markdown = htmlToMarkdown(`
      <h1>季度报告</h1>
      <p>正文 <strong>重点</strong> 与 <em>补充</em>、<del>废弃</del></p>
      <ul><li>第一项</li><li>第二项</li></ul>
      <table><thead><tr><th>名称</th><th>数量</th></tr></thead><tbody><tr><td>A</td><td>2</td></tr></tbody></table>
      <p><a href="https://example.com">详情</a></p>
    `);
    expect(markdown).toContain("# 季度报告");
    expect(markdown).toContain("**重点**");
    expect(markdown).toContain("*补充*");
    expect(markdown).toContain("~~废弃~~");
    expect(markdown).toMatch(/- {1,3}第一项\n- {1,3}第二项/);
    expect(markdown).toMatch(/\| 名称\s+\| 数量\s+\|/);
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("[详情](https://example.com)");
  });

  it("移除脚本、样式与 iframe", () => {
    const markdown = htmlToMarkdown('<script>alert(1)</script><style>p{color:red}</style><iframe src="https://evil.test"></iframe><p>安全正文</p>');
    expect(markdown).toBe("安全正文");
  });

  it("危险链接只保留文本", () => {
    const markdown = htmlToMarkdown('<a href="javascript:alert(1)">点击</a><a href="file:///etc/passwd">文件</a>');
    expect(markdown).toContain("点击");
    expect(markdown).toContain("文件");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).not.toContain("file:");
  });

  it("过滤 data/file 图片，保留占位符图片", () => {
    const markdown = htmlToMarkdown('<img src="data:image/png;base64,AAAA" alt="坏图"><img src="ainote-asset://0" alt="好图">');
    expect(markdown).not.toContain("data:");
    expect(markdown).toBe("![好图](ainote-asset://0)");
  });

  it("含列表或代码块的表格仍输出可编辑 Markdown 表格", () => {
    const markdown = htmlToMarkdown(`
      <table>
        <tr><th>事项</th><th>说明</th></tr>
        <tr><td><ul><li>第一项</li><li>第二项</li></ul></td><td><pre><code>const a = 1;</code></pre></td></tr>
      </table>
    `);
    expect(markdown).toContain("| 事项 | 说明 |");
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("第一项；第二项");
    expect(markdown).toContain("const a = 1;");
    expect(markdown).not.toMatch(/<(?:table|div|ul|pre)\b/i);
  });

  it("编码含空格的链接目标，并用尖括号包裹含括号的地址", () => {
    const markdown = htmlToMarkdown(`
      <a href="https://example.com/a b">空格</a>
      <a href="https://example.com/a(b)">括号</a>
    `);
    expect(markdown).toContain("[空格](https://example.com/a%20b)");
    expect(markdown).toContain("[括号](<https://example.com/a(b)>)");
  });
});

describe("isSafeHref", () => {
  it("允许网页、邮件、相对路径与导入占位符", () => {
    for (const href of ["https://example.com", "http://example.com", "mailto:a@b.c", "#top", "./a.md", "../a.md", "/a.md", "ainote-asset://2"]) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it("拒绝脚本、data、file 与非法协议", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "vbscript:msgbox(1)", "unknown-value"]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });
});
