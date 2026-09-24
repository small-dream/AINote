import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { activeTextStyle, clearTextStyle, isTextStyleActive, toggleTextStyle } from "./textStyleCommands";
import { TEXT_STYLE_SPECS, textStyleClass, type TextStyleKind } from "./textStyles";
import { richTextJsonToMarkdown } from "./markdownConversion";

interface MarkJson {
  type?: string;
  attrs?: Record<string, unknown>;
}

function createEditor(text = "重点句") {
  const element = document.createElement("div");
  return new Editor({ element, extensions: createRichTextExtensions(null), content: `<p>${text}</p>` });
}

/** 选中全部文字，模拟用户划词后设置样式。 */
function selectAll(editor: Editor): Editor {
  return editor.chain().focus().selectAll().run() as unknown as Editor;
}

function marksOf(editor: Editor): MarkJson[] {
  return marksOfNode(editor.getJSON()).filter((mark) => (mark.type ?? "") !== "bold");
}

/** 递归收集全部文本节点的 mark（段落里含双链 / 标签时会拆成多个 text 节点）。 */
function marksOfNode(node: unknown): MarkJson[] {
  if (Array.isArray(node)) return node.flatMap(marksOfNode);
  if (!node || typeof node !== "object") return [];
  const record = node as { marks?: MarkJson[]; content?: unknown };
  return [...(record.marks ?? []), ...marksOfNode(record.content)];
}

function expectMarkValue(editor: Editor, kind: TextStyleKind, value: string | null): void {
  const spec = TEXT_STYLE_SPECS[kind];
  const mark = marksOf(editor).find((item) => item.type === spec.markName);
  if (value === null) {
    expect(mark, `不应存在 ${spec.markName}`).toBeUndefined();
    return;
  }
  expect(mark?.attrs?.value).toBe(value);
}

describe("字符样式命令", () => {
  it("四组样式均可设置并写入预期 mark 与档位", () => {
    const cases: [TextStyleKind, string][] = [["font", "serif"], ["size", "xl"], ["color", "danger"], ["mark", "yellow"]];
    for (const [kind, value] of cases) {
      const editor = createEditor();
      selectAll(editor);
      toggleTextStyle(editor, kind, value);
      expectMarkValue(editor, kind, value);
      expect(isTextStyleActive(editor, kind, value)).toBe(true);
      expect(activeTextStyle(editor, kind)).toBe(value);
      editor.destroy();
    }
  });

  it("重复设置同一档位即取消（与加粗等行内格式语义一致）", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "mark", "yellow");
    toggleTextStyle(editor, "mark", "yellow");
    expectMarkValue(editor, "mark", null);
    expect(isTextStyleActive(editor, "mark")).toBe(false);
    editor.destroy();
  });

  it("切换到另一档位时覆盖旧值", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "color", "danger");
    toggleTextStyle(editor, "color", "success");
    expectMarkValue(editor, "color", "success");
    editor.destroy();
  });

  it("字号设回默认档时清除 mark（不写 base）", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "size", "lg");
    expectMarkValue(editor, "size", "lg");
    toggleTextStyle(editor, "size", "base");
    expectMarkValue(editor, "size", null);
    editor.destroy();
  });

  it("清除动作移除该组样式", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "font", "mono");
    clearTextStyle(editor, "font");
    expectMarkValue(editor, "font", null);
    expect(activeTextStyle(editor, "font")).toBeNull();
    editor.destroy();
  });

  it("非法档位被忽略，浏览器不抛错", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "color", "purple");
    expectMarkValue(editor, "color", null);
    editor.destroy();
  });
});

describe("字符样式渲染", () => {
  it("renderHTML 只输出 class 与语义标签，绝不输出 style（CSP 护栏）", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "color", "danger");
    toggleTextStyle(editor, "mark", "yellow");
    toggleTextStyle(editor, "size", "lg");
    const html = editor.view.dom.innerHTML;

    expect(html).toContain(`${textStyleClass("color", "danger")}`);
    expect(html).toContain(`${textStyleClass("mark", "yellow")}`);
    expect(html).toContain(`${textStyleClass("size", "lg")}`);
    expect(html).toContain("<mark");
    // 生产壳的 CSP 会拦掉行内 style 属性，出现即代表样式会在安装包里失效
    expect(html).not.toMatch(/style=/);
    expect(editor.getHTML()).not.toMatch(/style=/);
    editor.destroy();
  });

  it("高亮使用语义化 <mark>，其余用 <span>", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "mark", "blue");
    expect(editor.view.dom.querySelector("mark")?.className).toContain("rt-mark-blue");
    clearTextStyle(editor, "mark");
    toggleTextStyle(editor, "color", "accent");
    expect(editor.view.dom.querySelector("span")?.className).toContain("rt-fg-accent");
    editor.destroy();
  });

  it("只认自有 class：外部粘贴的 span[style] 不产生样式 mark", () => {
    const element = document.createElement("div");
    const editor = new Editor({
      element,
      extensions: createRichTextExtensions(null),
      content: '<p><span style="color: #ff0000; font-size: 20px">外部样式</span></p>',
    });
    expect(marksOf(editor)).toEqual([]);
    expect(editor.view.dom.querySelector("span")?.className ?? "").not.toMatch(/rt-(fg|size|font|mark)-/);
    editor.destroy();
  });

  it("非法档位 class 不进入文档（防脏数据）", () => {
    const element = document.createElement("div");
    const editor = new Editor({
      element,
      extensions: createRichTextExtensions(null),
      content: '<p><span class="rt-fg-purple">脏数据</span></p>',
    });
    expect(marksOf(editor)).toEqual([]);
    editor.destroy();
  });
});

describe("字符样式的稳定性", () => {
  it("撤销重做能还原样式，不残留 mark", () => {
    const editor = createEditor();
    selectAll(editor);
    toggleTextStyle(editor, "color", "danger");
    expectMarkValue(editor, "color", "danger");
    editor.chain().focus().undo().run();
    expectMarkValue(editor, "color", null);
    editor.chain().focus().redo().run();
    expectMarkValue(editor, "color", "danger");
    editor.destroy();
  });

  it("与双链 / 标签 mark 在同一段落共存，互不覆盖", () => {
    const element = document.createElement("div");
    const editor = new Editor({
      element,
      extensions: createRichTextExtensions(null),
      // 走 Markdown 解析路径（真实链路：`.md` 转换与 .ainote 的 markdown 往返都经过它）
      content: "见 [[项目计划]] 与 #bug",
    });
    editor.chain().focus().selectAll().setMark("markStyle", { value: "yellow" }).run();

    const marks = marksOf(editor).map((mark) => mark.type);
    expect(marks).toContain("markStyle");
    expect(marks).toContain("wikiLink");
    expect(marks).toContain("tag");
    // 序列化仍保留原文，Markdown 往返不被样式破坏
    const markdown = richTextJsonToMarkdown(JSON.stringify(editor.getJSON()));
    expect(markdown).toContain("[[项目计划]]");
    expect(markdown).toContain("#bug");
    editor.destroy();
  });

  it("图片与表格文档中设置样式不影响块级结构", () => {
    const element = document.createElement("div");
    const editor = new Editor({
      element,
      extensions: createRichTextExtensions(null),
      content: "<p>正文</p><table><tbody><tr><th>甲</th></tr><tr><td>乙</td></tr></tbody></table>",
    });
    editor.chain().focus().selectAll().setMark("sizeStyle", { value: "lg" }).run();
    const doc = editor.getJSON();
    expect(doc.content?.some((node) => node.type === "table")).toBe(true);
    expect(editor.view.dom.querySelector("table")).toBeTruthy();
    editor.destroy();
  });

  it("旧笔记（无任何字符样式）解析后重新序列化不产生变化", () => {
    const original = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题" }] },
        { type: "paragraph", content: [{ type: "text", text: "正文", marks: [{ type: "bold" }] }] },
      ],
    });
    const element = document.createElement("div");
    const editor = new Editor({ element, extensions: createRichTextExtensions(null), content: JSON.parse(original) as object });
    // 深比较：JSON 键序由 ProseMirror 决定，不构成内容变化
    expect(editor.getJSON()).toEqual(JSON.parse(original));
    expect(editor.getJSON()).not.toEqual(expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ marks: expect.arrayContaining([expect.objectContaining({ type: "markStyle" })]) })]) })]) }));
    editor.destroy();
  });
});

describe("字符样式与自定义 mark 的 Markdown 往返", () => {
  /** 回归护栏：tiptap-markdown 只按 mark 集合中 rank 最大的 mark 决定是否转义文本。
   * 自有 mark 的 priority 必须始终高于 WikiLink / TagMark（1000），否则 `[[双链]]`
   * 与 `#标签` 会被转义成 `\[\[…\]\]`，Markdown 往返与 Rust 侧 wiki 索引都会失配。 */
  it("加任意字符样式后，双链与标签原文不被转义", () => {
    const cases: [TextStyleKind, string][] = [["font", "mono"], ["size", "lg"], ["color", "danger"], ["mark", "yellow"]];
    for (const [kind, value] of cases) {
      const element = document.createElement("div");
      const editor = new Editor({ element, extensions: createRichTextExtensions(null), content: "见 [[项目计划]] 与 #bug" });
      editor.chain().focus().selectAll().setMark(TEXT_STYLE_SPECS[kind].markName, { value }).run();

      const markdown = richTextJsonToMarkdown(JSON.stringify(editor.getJSON()));
      expect(markdown, `${kind} 组合下双链被转义`).toContain("[[项目计划]]");
      expect(markdown, `${kind} 组合下标签被转义`).toContain("#bug");
      expect(markdown).not.toContain("\\[\\[");
      editor.destroy();
    }
  });

  it("自有 mark 的 rank 始终排在 WikiLink / TagMark 之前", () => {
    const editor = createEditor();
    // schema.marks 的键序即 prosemirror 的 mark rank 顺序（MarkType.compile 按排序后的顺序插入）
    const order = Object.keys(editor.schema.marks);
    const wikiIndex = order.indexOf("wikiLink");
    const tagIndex = order.indexOf("tag");
    for (const spec of Object.values(TEXT_STYLE_SPECS)) {
      const index = order.indexOf(spec.markName);
      expect(index, `${spec.markName} 未注册`).toBeGreaterThanOrEqual(0);
      expect(index, `${spec.markName} 必须排在 wikiLink 之前`).toBeLessThan(wikiIndex);
      expect(index, `${spec.markName} 必须排在 tag 之前`).toBeLessThan(tagIndex);
    }
    editor.destroy();
  });
});
