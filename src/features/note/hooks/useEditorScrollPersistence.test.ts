import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorScrollPersistence } from "./useEditorScrollPersistence";

function makeView() {
  return { scrollDOM: document.createElement("div") };
}

describe("useEditorScrollPersistence", () => {
  it("无关重渲染时保留用户刚滚动到的位置", () => {
    const view = makeView();
    const preview = document.createElement("div");
    const previewRef = { current: preview };
    const setEditorScrollTop = vi.fn();
    const setPreviewScrollTop = vi.fn();
    const { rerender } = renderHook(({ tick }) => {
      useEditorScrollPersistence(view as never, previewRef, "split", {
        editorScrollTop: 0,
        previewScrollTop: 0,
        setEditorScrollTop,
        setPreviewScrollTop,
      });
      return tick;
    }, { initialProps: { tick: 0 } });

    act(() => { view.scrollDOM.scrollTop = 280; });
    act(() => { rerender({ tick: 1 }); });

    expect(view.scrollDOM.scrollTop).toBe(280);
  });
});
