import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { CODE_LANGUAGES } from "../extensions/codeBlock";

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

describe("代码块语言选择", () => {
  it("语言列表覆盖常见语言且 id 不重复", () => {
    const ids = CODE_LANGUAGES.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["typescript", "python", "rust", "javascript", "bash"]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(CODE_LANGUAGES.every((item) => item.label.length > 0)).toBe(true);
  });

  it("updateAttributes 可切换代码块语言", () => {
    const element = document.createElement("div");
    const editor = new Editor({ element, extensions: createRichTextExtensions(null), content: "```\nfn main() {}\n```" });
    editor.chain().focus().updateAttributes("codeBlock", { language: "rust" }).run();
    const codeBlock = editor.getJSON().content?.[0] as { attrs?: { language?: string } } | undefined;
    expect(codeBlock?.attrs?.language).toBe("rust");
    editor.destroy();
  });
});
