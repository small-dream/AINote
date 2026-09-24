import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { indentPastedText, pasteIndentPrefix } from "./pasteIndent";

function stateWith(doc: string, anchor = doc.length): EditorState {
  return EditorState.create({ doc, selection: { anchor } });
}

describe("pasteIndentPrefix", () => {
  it("列表项内返回与内容等宽的前缀", () => {
    expect(pasteIndentPrefix("- ")).toBe("  ");
    expect(pasteIndentPrefix("- abc")).toBe("  ");
    expect(pasteIndentPrefix("1. ")).toBe("   ");
    expect(pasteIndentPrefix("10. abc")).toBe("    ");
    expect(pasteIndentPrefix("* ")).toBe("  ");
    expect(pasteIndentPrefix("+ abc")).toBe("  ");
  });

  it("嵌套列表保留已有缩进", () => {
    expect(pasteIndentPrefix("  - abc")).toBe("    ");
    expect(pasteIndentPrefix("\t- abc")).toBe("\t  ");
  });

  it("任务列表把复选框也算进宽度", () => {
    expect(pasteIndentPrefix("- [ ] abc")).toBe("      ");
    expect(pasteIndentPrefix("- [x] abc")).toBe("      ");
  });

  it("引用返回 > 标记", () => {
    expect(pasteIndentPrefix("> abc")).toBe("> ");
    expect(pasteIndentPrefix("> ")).toBe("> ");
    expect(pasteIndentPrefix(">> abc")).toBe(">> ");
  });

  it("引用内嵌列表同时保留两层", () => {
    expect(pasteIndentPrefix("> - abc")).toBe(">   ");
    expect(pasteIndentPrefix("> 1. abc")).toBe(">    ");
  });

  it("普通段落与缩进代码块不补前缀", () => {
    expect(pasteIndentPrefix("para text")).toBeNull();
    expect(pasteIndentPrefix("    indented code")).toBeNull();
    expect(pasteIndentPrefix("")).toBeNull();
  });

  it("光标位于容器标记之前时不补前缀", () => {
    expect(pasteIndentPrefix("abc")).toBeNull();
    expect(pasteIndentPrefix("-")).toBeNull();
  });
});

describe("indentPastedText", () => {
  it("多行粘贴给第二行起补列表缩进", () => {
    const state = stateWith("- first\n- ");
    expect(indentPastedText("alpha\nbeta", state)).toBe("alpha\n  beta");
  });

  it("多行粘贴给引用后续行补 > 标记", () => {
    const state = stateWith("> ");
    expect(indentPastedText("alpha\nbeta", state)).toBe("alpha\n> beta");
  });

  it("空行不补前缀，避免尾随空格", () => {
    const state = stateWith("- ");
    expect(indentPastedText("alpha\n\nbeta", state)).toBe("alpha\n\n  beta");
  });

  it("单行粘贴原样返回", () => {
    const state = stateWith("- ");
    expect(indentPastedText("alpha", state)).toBe("alpha");
  });

  it("普通段落内多行粘贴不改变文本", () => {
    const state = stateWith("para ");
    expect(indentPastedText("alpha\nbeta", state)).toBe("alpha\nbeta");
  });

  it("归一化 CRLF 换行", () => {
    const state = stateWith("- ");
    expect(indentPastedText("alpha\r\nbeta", state)).toBe("alpha\n  beta");
  });

  it("按起点所在行计算前缀（替换选区场景）", () => {
    const doc = "- alpha beta";
    const state = stateWith(doc, 4);
    const selected = EditorState.create({ doc, selection: { anchor: 2, head: 7 } });
    expect(indentPastedText("x\ny", selected)).toBe("x\n  y");
    expect(state.selection.main.from).toBe(4);
  });
});
