import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { applyFormat, captureFormat, type CopiedFormat } from "./formatPainter";

interface TextRange {
  from: number;
  to: number;
}

function createEditor(content: string): Editor {
  const element = document.createElement("div");
  return new Editor({ element, extensions: createRichTextExtensions(null), content });
}

/** 定位文本在文档中的位置：段落里含双链 / 标签时同一段会被拆成多个 text 节点，逐节点查找。 */
function findText(editor: Editor, text: string): TextRange {
  let range: TextRange | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (range || !node.isText) return true;
    const index = (node.text ?? "").indexOf(text);
    if (index === -1) return true;
    range = { from: pos + index, to: pos + index + text.length };
    return false;
  });
  if (!range) throw new Error(`文档中没有找到文本：${text}`);
  return range;
}

function selectText(editor: Editor, text: string): void {
  const { from, to } = findText(editor, text);
  editor.chain().focus().setTextSelection({ from, to }).run();
}

function copyFrom(editor: Editor, text: string): CopiedFormat {
  selectText(editor, text);
  return captureFormat(editor.state);
}

function markNamesOf(editor: Editor, text: string): string[] {
  return (editor.state.doc.nodeAt(findText(editor, text).from)?.marks ?? []).map((mark) => mark.type.name);
}

function blockOf(editor: Editor, text: string): { type: string; level?: unknown } {
  const parent = editor.state.doc.resolve(findText(editor, text).from).parent;
  return { type: parent.type.name, ...(parent.type.name === "heading" ? { level: parent.attrs.level } : {}) };
}

describe("captureFormat", () => {
  it("采集选区的行内 mark 与块级类型", () => {
    const editor = createEditor("<h2><strong>小标题</strong></h2><p>正文段落</p>");
    const format = copyFrom(editor, "小标题");

    expect(format.marks.map((mark) => mark.type)).toEqual(["bold"]);
    expect(format.block).toEqual({ type: "heading", level: 2 });
    editor.destroy();
  });

  it("采集字符级样式（字号 / 高亮）的枚举档位", () => {
    const editor = createEditor("<p>重点</p><p>普通</p>");
    selectText(editor, "重点");
    editor.chain().focus().setMark("sizeStyle", { value: "xl" }).setMark("markStyle", { value: "yellow" }).run();
    const format = captureFormat(editor.state);

    expect(format.marks).toEqual(expect.arrayContaining([
      { type: "sizeStyle", attrs: { value: "xl" } },
      { type: "markStyle", attrs: { value: "yellow" } },
    ]));
    editor.destroy();
  });

  it("链接 / 双链 / 标签是内容语义，不进入格式刷", () => {
    const editor = createEditor("<p>目标笔记</p><p>普通</p>");
    selectText(editor, "目标笔记");
    editor.chain().focus().setMark("link", { href: "https://example.com" }).setMark("wikiLink", { target: "目标笔记" }).setMark("bold").run();
    const format = captureFormat(editor.state);

    expect(format.marks.map((mark) => mark.type)).toEqual(["bold"]);
    editor.destroy();
  });

  it("光标落在加粗文本内部时按光标处格式采集", () => {
    const editor = createEditor("<p><strong>加粗</strong>普通</p>");
    editor.chain().focus().setTextSelection(findText(editor, "加粗").from + 1).run();

    expect(captureFormat(editor.state).marks.map((mark) => mark.type)).toEqual(["bold"]);
    editor.destroy();
  });
});

describe("applyFormat", () => {
  it("把源格式刷到目标选区", () => {
    const editor = createEditor("<p><strong>重点</strong></p><p>普通文本</p>");
    const format = copyFrom(editor, "重点");

    selectText(editor, "普通文本");
    applyFormat(editor, format);

    expect(markNamesOf(editor, "普通文本")).toEqual(["bold"]);
    editor.destroy();
  });

  it("目标原有格式被替换而不是叠加", () => {
    const editor = createEditor("<p><em>斜体源</em></p><p><strong>加粗目标</strong></p>");
    const format = copyFrom(editor, "斜体源");

    selectText(editor, "加粗目标");
    applyFormat(editor, format);

    expect(markNamesOf(editor, "加粗目标")).toEqual(["italic"]);
    editor.destroy();
  });

  it("从正文复制格式会清掉目标样式，但保留链接", () => {
    const editor = createEditor('<p>纯文本</p><p><a href="https://example.com">链接文字</a></p>');
    const format = copyFrom(editor, "纯文本");

    selectText(editor, "链接文字");
    applyFormat(editor, format);

    expect(markNamesOf(editor, "链接文字")).toEqual(["link"]);
    editor.destroy();
  });

  it("字符级样式随格式刷一起落到目标", () => {
    const editor = createEditor("<p>重点</p><p>普通</p>");
    selectText(editor, "重点");
    editor.chain().focus().setMark("markStyle", { value: "yellow" }).run();
    const format = captureFormat(editor.state);

    selectText(editor, "普通");
    applyFormat(editor, format);

    expect(markNamesOf(editor, "普通")).toContain("markStyle");
    expect(editor.getAttributes("markStyle").value).toBe("yellow");
    editor.destroy();
  });

  it("标题级别刷到正文段落，正文档位刷回标题", () => {
    const editor = createEditor("<h2>小标题</h2><p>正文段落</p>");
    const paragraphFormat = copyFrom(editor, "正文段落");
    const headingFormat = copyFrom(editor, "小标题");

    selectText(editor, "正文段落");
    applyFormat(editor, headingFormat);
    expect(blockOf(editor, "正文段落")).toEqual({ type: "heading", level: 2 });

    selectText(editor, "小标题");
    applyFormat(editor, paragraphFormat);
    expect(blockOf(editor, "小标题")).toEqual({ type: "paragraph" });
    editor.destroy();
  });
});
