import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorPreferences } from "./useEditorPreferences";

beforeEach(() => {
  localStorage.clear();
});

describe("useEditorPreferences", () => {
  it("持久化滚动位置时不触发组件重渲染", () => {
    const { result } = renderHook(() => useEditorPreferences("/repo", "note.md"));
    const initial = result.current;

    act(() => {
      result.current.setEditorScrollTop(120);
      result.current.setPreviewScrollTop(240);
    });

    expect(result.current).toBe(initial);
    expect(result.current.preferences.editorScrollTop).toBe(0);
    expect(JSON.parse(localStorage.getItem("ainote.editor-preferences:%2Frepo:note.md") ?? "{}"))
      .toMatchObject({ editorScrollTop: 120, previewScrollTop: 240 });
  });

  it("模式和比例变化仍会刷新偏好", () => {
    const { result } = renderHook(() => useEditorPreferences("/repo", "note.md"));

    act(() => result.current.setMode("split"));
    expect(result.current.preferences.mode).toBe("split");

    act(() => result.current.setRatio(0.7));
    expect(result.current.preferences.ratio).toBe(0.7);
  });
});
