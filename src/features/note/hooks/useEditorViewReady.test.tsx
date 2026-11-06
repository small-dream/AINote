import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { mountEditor } from "@/test/editorHarness";
import { clearEditorSelectionMemory, editorSelectionKey, rememberEditorSelection } from "../utils/editorSelectionStore";
import { useEditorViewReady } from "./useEditorViewReady";

describe("useEditorViewReady", () => {
  beforeEach(clearEditorSelectionMemory);

  it("新视图就绪时还原同一篇笔记的选区并登记实例", () => {
    const key = editorSelectionKey("/repo", "a.md");
    rememberEditorSelection(key, { anchor: 6, head: 2 });
    const onCreate = vi.fn();
    const { result } = renderHook(() => useEditorViewReady(onCreate, key));
    const view = mountEditor([], "hello world", 0);

    act(() => result.current.handleCreateEditor(view));

    expect(onCreate).toHaveBeenCalledWith(view);
    expect(view.state.selection.main.head).toBe(2);
    expect(result.current.readyView).toBe(view);
  });

  it("没有可还原的选区时补发事务，让工具栏按新光标重算格式", () => {
    const updates: boolean[] = [];
    const { result } = renderHook(() => useEditorViewReady(vi.fn(), null));
    const view = mountEditor([EditorView.updateListener.of((update) => updates.push(update.selectionSet))], "hello");

    act(() => result.current.handleCreateEditor(view));

    expect(updates).toEqual([true]);
  });
});
