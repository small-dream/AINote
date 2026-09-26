import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { useFormatPainter, FORMAT_PAINTER_DELAY_MS } from "./useFormatPainter";

const applyFormatMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/formatPainter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/formatPainter")>();
  return { ...actual, applyFormat: applyFormatMock };
});

interface Selection {
  from: number;
  to: number;
}

/** 只提供 captureFormat / 选区事件所需字段的最简编辑器替身。 */
function createFakeEditor() {
  const handlers = new Set<() => void>();
  const state = {
    storedMarks: [] as unknown[],
    selection: {
      from: 1,
      to: 1,
      get empty() { return this.from === this.to; },
      $from: { parent: { type: { name: "paragraph" }, attrs: {} }, marks: () => [] },
    },
  };
  const editor = {
    state,
    on: (event: string, handler: () => void) => { if (event === "selectionUpdate") handlers.add(handler); },
    off: (event: string, handler: () => void) => { if (event === "selectionUpdate") handlers.delete(handler); },
  } as unknown as Editor;
  return {
    editor,
    listenerCount: () => handlers.size,
    select: ({ from, to }: Selection) => {
      state.selection.from = from;
      state.selection.to = to;
      handlers.forEach((handler) => handler());
    },
  };
}

afterEach(() => {
  applyFormatMock.mockReset();
  vi.useRealTimers();
});

describe("useFormatPainter", () => {
  it("待刷态下选区变化自动套用格式并退出待刷", () => {
    vi.useFakeTimers();
    const { editor, select } = createFakeEditor();
    const { result } = renderHook(() => useFormatPainter(editor));

    act(() => result.current.toggle());
    expect(result.current.armed).toBe(true);

    act(() => select({ from: 1, to: 5 }));
    expect(applyFormatMock).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(FORMAT_PAINTER_DELAY_MS); });
    expect(applyFormatMock).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it("拖拽过程中连续触发选区变化只在停手后应用一次", () => {
    vi.useFakeTimers();
    const { editor, select } = createFakeEditor();
    const { result } = renderHook(() => useFormatPainter(editor));

    act(() => result.current.toggle());
    act(() => select({ from: 1, to: 2 }));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => select({ from: 1, to: 5 }));
    act(() => { vi.advanceTimersByTime(FORMAT_PAINTER_DELAY_MS); });

    expect(applyFormatMock).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it("空选区保持待刷态，不会误刷到光标处", () => {
    vi.useFakeTimers();
    const { editor, select } = createFakeEditor();
    const { result } = renderHook(() => useFormatPainter(editor));

    act(() => result.current.toggle());
    act(() => select({ from: 3, to: 3 }));
    act(() => { vi.advanceTimersByTime(FORMAT_PAINTER_DELAY_MS); });

    expect(applyFormatMock).not.toHaveBeenCalled();
    expect(result.current.armed).toBe(true);
  });

  it("再次单击取消待刷态，之后的选区变化不再套用", () => {
    vi.useFakeTimers();
    const { editor, select } = createFakeEditor();
    const { result } = renderHook(() => useFormatPainter(editor));

    act(() => { result.current.toggle(); result.current.toggle(); });
    expect(result.current.armed).toBe(false);

    act(() => select({ from: 1, to: 5 }));
    act(() => { vi.advanceTimersByTime(FORMAT_PAINTER_DELAY_MS); });

    expect(applyFormatMock).not.toHaveBeenCalled();
  });

  it("退出待刷态后不再监听选区变化", () => {
    vi.useFakeTimers();
    const { editor, listenerCount } = createFakeEditor();
    const { result, unmount } = renderHook(() => useFormatPainter(editor));

    expect(listenerCount()).toBe(0);
    act(() => result.current.toggle());
    expect(listenerCount()).toBe(1);
    unmount();
    expect(listenerCount()).toBe(0);
  });
});
