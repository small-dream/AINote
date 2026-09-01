import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { CODE_LANGUAGES } from "../extensions/codeBlock";

function createTestEditor(markdown: string) {
  const element = document.createElement("div");
  return new Editor({ element, extensions: createRichTextExtensions(null), content: markdown });
}

describe("代码块语法高亮", () => {
  it("带语言的代码块渲染头部语言下拉与 language 类", () => {
    const editor = createTestEditor("```ts\nconst n: number = 1\n```");
    const select = editor.view.dom.querySelector<HTMLSelectElement>(".code-block-language");
    expect(select?.value).toBe("ts");
    expect(editor.view.dom.querySelector("code")?.className).toContain("language-ts");
    editor.destroy();
  });

  it("代码块由 Lowlight 添加 hljs token 高亮", () => {
    const editor = createTestEditor("```ts\nconst n: number = 1\n```");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("hljs-number");
    editor.destroy();
  });

  it("未指定语言的代码块自动检测语言并高亮", () => {
    const editor = createTestEditor("```\nconst n: number = 1\n```");
    const html = editor.view.dom.innerHTML;
    expect(html).toMatch(/hljs-[a-z-]+/);
    expect(editor.view.dom.querySelector<HTMLSelectElement>(".code-block-language")?.value).toBe("");
    editor.destroy();
  });

  it("getHTML 序列化保留 data-language 与语言类", () => {
    const editor = createTestEditor("```ts\nconst n: number = 1\n```");
    const html = editor.getHTML();
    expect(html).toContain('data-language="ts"');
    expect(html).toContain('class="language-ts"');
    editor.destroy();
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
    const editor = createTestEditor("```\nfn main() {}\n```");
    editor.chain().focus().updateAttributes("codeBlock", { language: "rust" }).run();
    const codeBlock = editor.getJSON().content?.[0] as { attrs?: { language?: string } } | undefined;
    expect(codeBlock?.attrs?.language).toBe("rust");
    expect(editor.view.dom.querySelector<HTMLSelectElement>(".code-block-language")?.value).toBe("rust");
    editor.destroy();
  });
});
