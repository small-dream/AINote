import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";

function renderRichText(markdown: string) {
  const element = document.createElement("div");
  const editor = new Editor({ element, extensions: createRichTextExtensions(null), content: markdown });
  const html = editor.view.dom.innerHTML;
  editor.destroy();
  return html;
}

describe("代码块语法高亮", () => {
  it("带语言的代码块渲染 data-language 与 language 类", () => {
    const html = renderRichText("```ts\nconst n: number = 1\n```");
    expect(html).toContain('data-language="ts"');
    expect(html).toContain('class="language-ts"');
  });

  it("代码块由 Lowlight 添加 hljs token 高亮", () => {
    const html = renderRichText("```ts\nconst n: number = 1\n```");
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("hljs-number");
  });

  it("未指定语言的代码块自动检测语言并高亮", () => {
    const html = renderRichText("```\nconst n: number = 1\n```");
    expect(html).toMatch(/hljs-[a-z-]+/);
  });
});
