import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createRichTextExtensions } from "./extensions";
import { CLEAR_FORMAT_COMMAND } from "./toolbarCommands";

function createEditor(markdown: string): Editor {
  return new Editor({ element: document.createElement("div"), extensions: createRichTextExtensions(null), content: markdown });
}

interface JsonNode {
  type?: string;
  marks?: { type?: string }[];
  content?: JsonNode[];
}

/** 文档第一个文本块的类型与块内全部 mark 名。 */
function blockAndMarks(editor: Editor): { block: string; marks: string[] } {
  const first = (editor.getJSON() as JsonNode).content?.[0];
  if (first?.type !== "paragraph" && first?.type !== "heading") return { block: "none", marks: [] };
  return { block: first.type, marks: textMarks(first) };
}

function textMarks(node: JsonNode): string[] {
  const own = (node.marks ?? []).map((mark) => String(mark.type));
  return [...own, ...(node.content ?? []).flatMap(textMarks)];
}

describe("CLEAR_FORMAT_COMMAND", () => {
  it("清掉行内 mark 与块级类型：标题回到正文", () => {
    const editor = createEditor("## 小标题\n\n正文段落");
    editor.chain().focus().selectAll().setMark("markStyle", { value: "yellow" }).setMark("bold").run();
    const before = blockAndMarks(editor);
    expect(before.block).toBe("heading");
    expect([...before.marks].sort()).toEqual(["bold", "markStyle"]);

    editor.chain().focus().selectAll().run();
    CLEAR_FORMAT_COMMAND.run(editor);

    expect(blockAndMarks(editor)).toEqual({ block: "paragraph", marks: [] });
    expect(editor.getJSON()).toMatchObject({ content: [{ type: "paragraph" }, { type: "paragraph" }] });
    editor.destroy();
  });
});
