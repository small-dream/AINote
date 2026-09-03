import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SIDEBAR_WIDTH_STORAGE_KEY, useUiStore } from "@/stores/ui.store";
import { useSidebarResizer } from "./useSidebarResizer";

function createPointerEvent(type: string, clientX: number): PointerEvent {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  return event as PointerEvent;
}

describe("useSidebarResizer", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ sidebarWidth: 248 });
  });

  it("拖动分割线更新宽度，结束时持久化", () => {
    const { result } = renderHook(() => useSidebarResizer());
    const { onPointerDown } = result.current.resizeHandleProps;

    act(() => {
      onPointerDown({
        clientX: 252,
        button: 0,
        isPrimary: true,
        preventDefault: () => {},
        currentTarget: {
          getBoundingClientRect: () => ({ left: 248, width: 8 }),
        },
      } as ReactPointerEvent<HTMLDivElement>);
    });
    fireEvent(window, createPointerEvent("pointermove", 324));

    expect(result.current.sidebarWidth).toBe(320);
    expect(document.body.classList.contains("sidebar-resizing")).toBe(true);

    fireEvent(window, createPointerEvent("pointerup", 172));

    expect(result.current.isResizing).toBe(false);
    expect(document.body.classList.contains("sidebar-resizing")).toBe(false);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("320");
  });
});
