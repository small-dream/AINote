import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
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
});
