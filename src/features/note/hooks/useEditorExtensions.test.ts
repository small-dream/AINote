import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { undo } from "@codemirror/commands";
import { useUiStore } from "@/stores/ui.store";
import { mountEditor } from "@/test/editorHarness";
import { clearEditorSelectionMemory, editorSelectionKey, readEditorSelection } from "../utils/editorSelectionStore";
import { useEditorExtensions } from "./useEditorExtensions";

describe("useEditorExtensions", () => {
  beforeEach(() => {
    useUiStore.setState({ noteTheme: "classic" });
  });

  it("阅读主题切换后重新生成扩展数组（dark 标志跟随笔记主题而非全局明暗）", () => {
    const { result, rerender } = renderHook(() => useEditorExtensions());
    const lightExtensions = result.current.extensions;

    act(() => {
      useUiStore.setState({ noteTheme: "midnight" });
    });
    rerender();

    expect(result.current.extensions).not.toBe(lightExtensions);
    expect(result.current.extensions.length).toBe(lightExtensions.length);
  });

  it("软渲染参数改变扩展数组（关闭软渲染时追加语法高亮扩展）", () => {
    const { result, rerender } = renderHook(
      ({ softRender }) => useEditorExtensions({ softRenderEnabled: softRender }),
      { initialProps: { softRender: true } }
    );
    const withSoftRender = result.current.extensions;

    rerender({ softRender: false });

    expect(result.current.extensions).not.toBe(withSoftRender);
  });

  it("文档事务更新撤销和重做可用状态", () => {
    const { result } = renderHook(() => useEditorExtensions({ softRenderEnabled: false }));
    const view = mountEditor(result.current.extensions, "hello");

    act(() => {
      view.dispatch({ changes: { from: 5, insert: "!" } });
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      undo(view);
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("同步光标行列并在切换笔记时复位", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useEditorExtensions({ softRenderEnabled: false, resetKey }),
      { initialProps: { resetKey: "a.md" } },
    );
    const view = mountEditor(result.current.extensions, "one\ntwo");

    act(() => view.dispatch({ selection: { anchor: 6 } }));
    expect(result.current.cursorPosition).toEqual({ line: 2, column: 3 });

    rerender({ resetKey: "b.md" });
    expect(result.current.cursorPosition).toEqual({ line: 1, column: 1 });
    act(() => view.dispatch({ selection: { anchor: 1 } }));
    expect(result.current.cursorPosition).toEqual({ line: 1, column: 2 });
  });

  it("打字机模式改变扩展集合", () => {
    const { result, rerender } = renderHook(
      ({ typewriter }) => useEditorExtensions({ softRenderEnabled: false, typewriterMode: typewriter }),
      { initialProps: { typewriter: false } },
    );
    const normal = result.current.extensions;
    rerender({ typewriter: true });
    expect(result.current.extensions).not.toBe(normal);
  });
});

describe("useEditorExtensions / 选区匹配", () => {
  it("短选不提示，同词选区命中不超过 12 处", async () => {
    useUiStore.setState({ noteTheme: "classic" });
    const { result } = renderHook(() => useEditorExtensions({ softRenderEnabled: false }));
    const view = mountEditor(result.current.extensions, "lorem ".repeat(11) + "lorem");
    act(() => view.dispatch({ selection: { anchor: 0, head: 3 } }));
    expect(view.dom.querySelectorAll(".cm-selectionMatch")).toHaveLength(0);

    act(() => view.dispatch({ selection: { anchor: 0, head: 5 } }));
    expect(view.dom.querySelectorAll(".cm-selectionMatch")).toHaveLength(11);
  });
});

describe("useEditorExtensions / 选区快照", () => {
  beforeEach(() => {
    useUiStore.setState({ noteTheme: "classic" });
    clearEditorSelectionMemory();
  });

  it("把最新选区记到当前笔记下，切换笔记后记到新键", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useEditorExtensions({ softRenderEnabled: false, repoPath: "/repo", resetKey }),
      { initialProps: { resetKey: "a.md" } },
    );
    const viewA = mountEditor(result.current.extensions, "hello world");

    act(() => viewA.dispatch({ selection: { anchor: 7, head: 2 } }));
    expect(readEditorSelection(editorSelectionKey("/repo", "a.md"))).toEqual({ anchor: 7, head: 2 });

    rerender({ resetKey: "b.md" });
    const viewB = mountEditor(result.current.extensions, "hello world");
    act(() => viewB.dispatch({ selection: { anchor: 3, head: 3 } }));
    expect(readEditorSelection(editorSelectionKey("/repo", "b.md"))).toEqual({ anchor: 3, head: 3 });
  });
});
