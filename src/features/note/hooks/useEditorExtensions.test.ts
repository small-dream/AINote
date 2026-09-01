import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { useEditorExtensions } from "./useEditorExtensions";

describe("useEditorExtensions", () => {
  beforeEach(() => {
    useUiStore.setState({ theme: "light" });
  });

  it("主题切换后重新生成扩展数组", () => {
    const { result, rerender } = renderHook(() => useEditorExtensions());
    const lightExtensions = result.current.extensions;

    act(() => {
      useUiStore.setState({ theme: "dark" });
    });
    rerender();

    expect(result.current.extensions).not.toBe(lightExtensions);
    expect(result.current.extensions.length).toBe(lightExtensions.length);
  });

  it("软渲染参数改变扩展数组长度", () => {
    const { result, rerender } = renderHook(
      ({ softRender }) => useEditorExtensions({ softRenderEnabled: softRender }),
      { initialProps: { softRender: true } }
    );
    const withSoftRender = result.current.extensions.length;

    rerender({ softRender: false });

    expect(result.current.extensions.length).toBeLessThan(withSoftRender);
  });
});
