import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_PREFERENCES, readEditorPreferences, writeEditorPreferences } from "./editorPreferences";

describe("editor preferences", () => {
  beforeEach(() => localStorage.clear());

  it("按仓库和笔记持久化视图、比例与滚动位置", () => {
    writeEditorPreferences("/repo", "notes/a.md", { mode: "split", ratio: 0.7, editorScrollTop: 120, previewScrollTop: 240 });
    expect(readEditorPreferences("/repo", "notes/a.md")).toEqual({ mode: "split", ratio: 0.7, editorScrollTop: 120, previewScrollTop: 240 });
    expect(readEditorPreferences("/repo", "notes/b.md")).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it("非法数据回退并限制分栏比例", () => {
    localStorage.setItem("ainote.editor-preferences:%2Frepo:a.md", JSON.stringify({ mode: "bad", ratio: 9, editorScrollTop: -1 }));
    expect(readEditorPreferences("/repo", "a.md")).toEqual({ ...DEFAULT_EDITOR_PREFERENCES, ratio: 0.8 });
  });

  it("旧数据中的多余字段被忽略", () => {
    localStorage.setItem("ainote.editor-preferences:%2Frepo:a.md", JSON.stringify({ mode: "edit", ratio: 0.5, softRender: false }));
    expect(readEditorPreferences("/repo", "a.md")).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});
