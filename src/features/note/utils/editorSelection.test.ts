import { beforeEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { mountEditor } from "@/test/editorHarness";
import { clampEditorSelection, notifyEditorReady, restoreEditorSelection } from "./editorSelection";
import { clearEditorSelectionMemory, editorSelectionKey, rememberEditorSelection } from "./editorSelectionStore";

describe("clampEditorSelection", () => {
  it("文档范围内的选区原样保留（含反向选择）", () => {
    expect(clampEditorSelection({ anchor: 6, head: 2 }, 11)).toEqual({ anchor: 6, head: 2 });
  });

  it("越界或负数的选区夹到文档两端", () => {
    expect(clampEditorSelection({ anchor: -3, head: 99 }, 11)).toEqual({ anchor: 0, head: 11 });
  });

  it("空文档统一夹到 0", () => {
    expect(clampEditorSelection({ anchor: 8, head: 4 }, 0)).toEqual({ anchor: 0, head: 0 });
  });
});

describe("restoreEditorSelection", () => {
  beforeEach(clearEditorSelectionMemory);

  it("把同一篇笔记上一次的选区还给新实例", () => {
    const key = editorSelectionKey("/repo", "a.md");
    rememberEditorSelection(key, { anchor: 6, head: 2 });
    const view = mountEditor([], "hello world", 0);

    expect(restoreEditorSelection(view, key)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(2);
  });

  it("没有快照或光标未变时不派发事务", () => {
    const view = mountEditor([], "hello", 2);
    expect(restoreEditorSelection(view, editorSelectionKey("/repo", "a.md"))).toBe(false);

    rememberEditorSelection(editorSelectionKey("/repo", "a.md"), { anchor: 2, head: 2 });
    expect(restoreEditorSelection(view, editorSelectionKey("/repo", "a.md"))).toBe(false);
  });
});

describe("notifyEditorReady", () => {
  it("派发一次选区事务，让新建视图补算工具栏格式", () => {
    const updates: { selectionSet: boolean; docChanged: boolean }[] = [];
    const view = mountEditor([EditorView.updateListener.of((update) => updates.push({ selectionSet: update.selectionSet, docChanged: update.docChanged }))], "hello", 2);

    notifyEditorReady(view);

    expect(updates).toEqual([{ selectionSet: true, docChanged: false }]);
  });
});
