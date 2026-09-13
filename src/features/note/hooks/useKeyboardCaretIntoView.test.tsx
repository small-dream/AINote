import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { EditorView } from "@codemirror/view";
import { useKeyboardCaretIntoView } from "./useKeyboardCaretIntoView";

interface FakeVisualViewport {
  height: number;
  offsetTop: number;
  emit: () => void;
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
});

describe("useKeyboardCaretIntoView", () => {
  it("键盘弹起后把光标滚进可视区", async () => {
    const viewport = installVisualViewport(800);
    const { view, dispatch } = createView();
    renderHook(() => useKeyboardCaretIntoView(view, true));

    viewport.height = 500;
    viewport.emit();

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(view.requestMeasure).toHaveBeenCalled();
  });

  it("键盘收起时不触发滚动", async () => {
    const viewport = installVisualViewport(800);
    const { view, dispatch } = createView();
    renderHook(() => useKeyboardCaretIntoView(view, true));

    viewport.emit();
    await Promise.resolve();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("非移动壳（enabled=false）不订阅也不滚动", async () => {
    const viewport = installVisualViewport(800);
    const { view, dispatch } = createView();
    renderHook(() => useKeyboardCaretIntoView(view, false));

    viewport.height = 500;
    viewport.emit();
    await Promise.resolve();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("没有视图时不报错", async () => {
    const viewport = installVisualViewport(800);
    renderHook(() => useKeyboardCaretIntoView(null, true));

    viewport.height = 500;
    viewport.emit();
    await Promise.resolve();
  });
});

function createView(): { view: EditorView; dispatch: ReturnType<typeof vi.fn>; requestMeasure: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const requestMeasure = vi.fn();
  const view = { state: { selection: { main: { head: 12 } } }, dispatch, requestMeasure } as unknown as EditorView;
  return { view, dispatch, requestMeasure };
}

function installVisualViewport(height: number): FakeVisualViewport {
  const listeners = new Set<() => void>();
  const viewport = {
    height,
    offsetTop: 0,
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
    emit: () => listeners.forEach((listener) => listener()),
  };
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true, writable: true });
  return viewport;
}
