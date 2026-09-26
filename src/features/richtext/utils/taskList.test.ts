import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { markdownToRichTextJson, richTextJsonToMarkdown } from "./markdownConversion";

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
}

function taskItems(markdown: string): JsonNode[] {
  const doc = JSON.parse(markdownToRichTextJson(markdown)) as JsonNode;
  const list = doc.content?.[0];
  expect(list?.type).toBe("taskList");
  return list?.content ?? [];
}

function createTestEditor(markdown: string): Editor {
  return new Editor({ element: document.createElement("div"), extensions: createRichTextExtensions(null), content: markdown });
}

describe("富文本任务列表", () => {
  it("Markdown 复选框解析为 taskList / taskItem，勾选状态跟随 [ ] / [x]", () => {
    const items = taskItems("- [ ] 写周报\n- [x] 发版本");

    expect(items.map((item) => item.type)).toEqual(["taskItem", "taskItem"]);
    expect(items.map((item) => item.attrs?.checked)).toEqual([false, true]);
  });

  it("嵌套任务列表按缩进还原为子项", () => {
    const items = taskItems("- [ ] 父项\n  - [ ] 子项");

    expect(items[0]?.content?.at(-1)?.type).toBe("taskList");
    expect(items[0]?.content?.at(-1)?.content?.[0]?.attrs?.checked).toBe(false);
  });

  it("回写 Markdown 保留勾选状态，不残留 HTML", () => {
    const markdown = richTextJsonToMarkdown(markdownToRichTextJson("- [ ] 写周报\n- [x] 发版本"));

    expect(markdown).toContain("- [ ] 写周报");
    expect(markdown).toContain("- [x] 发版本");
    expect(markdown).not.toContain("<input");
  });

  it("编辑器里任务项带 data-checked，勾选后写回 JSON 并同步勾选态", () => {
    const editor = createTestEditor("- [ ] 写周报");
    const item = editor.view.dom.querySelector<HTMLElement>('ul[data-type="taskList"] > li');
    const checkbox = item?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(item?.dataset.checked).toBe("false");

    checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    checkbox?.dispatchEvent(new Event("change", { bubbles: true }));

    const json = editor.getJSON() as JsonNode;
    expect(json.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true);
    expect(editor.view.dom.querySelector<HTMLElement>('ul[data-type="taskList"] > li')?.dataset.checked).toBe("true");
    editor.destroy();
  });

  it("静态 HTML（导出 / 复制用）保留 data-type，样式选择器两条路径都命中", () => {
    const editor = createTestEditor("- [x] 写周报");

    expect(editor.getHTML()).toContain('li data-checked="true" data-type="taskItem"');
    expect(editor.view.dom.querySelector('ul[data-type="taskList"] > li')).not.toBeNull();
    editor.destroy();
  });
});
