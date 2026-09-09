import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileEditorView } from "./useMobileEditorView";

describe("useMobileEditorView", () => {
  beforeEach(() => {
    window.history.replaceState({}, "");
  });

  it("opens the editor when selection changes and returns to the list", () => {
    const onBackToList = vi.fn();
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook((props) => useMobileEditorView({
      currentNotePath: null,
      openEditorSignal: 0,
      onBackToList,
      onFlush,
      ...props,
    }), { initialProps: {} });
    expect(result.current.showEditor).toBe(false);
    act(() => {
      rerender({ currentNotePath: "notes/todo.md", openEditorSignal: 1, onBackToList, onFlush });
    });
    expect(result.current.showEditor).toBe(true);
    act(() => { result.current.backToList(); });
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(result.current.showEditor).toBe(false);
  });
});
