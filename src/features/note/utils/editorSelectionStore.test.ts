import { describe, expect, it } from "vitest";
import { clearEditorSelectionMemory, editorSelectionKey, readEditorSelection, rememberEditorSelection } from "./editorSelectionStore";

describe("editorSelectionKey", () => {
  it("用仓库与笔记路径组成键，没有笔记时返回 null", () => {
    expect(editorSelectionKey("/repo", "a.md")).toBe("/repo\u0000a.md");
    expect(editorSelectionKey(null, "a.md")).toBe("\u0000a.md");
    expect(editorSelectionKey("/repo", null)).toBeNull();
  });
});

describe("选区快照存取", () => {
  it("按笔记键存取，未记录时返回 null", () => {
    clearEditorSelectionMemory();
    const key = editorSelectionKey("/repo", "a.md");
    expect(readEditorSelection(key)).toBeNull();

    rememberEditorSelection(key, { anchor: 4, head: 1 });
    expect(readEditorSelection(key)).toEqual({ anchor: 4, head: 1 });
    expect(readEditorSelection(editorSelectionKey("/repo", "b.md"))).toBeNull();
  });

  it("没有键时不写入也不读取", () => {
    clearEditorSelectionMemory();
    rememberEditorSelection(null, { anchor: 4, head: 1 });
    expect(readEditorSelection(null)).toBeNull();
  });
});
