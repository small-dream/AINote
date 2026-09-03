import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useUiStore,
} from "@/stores/ui.store";

const KEYBOARD_RESIZE_STEP = 16;
interface DragStart {
  pointerX: number;
  width: number;
}

export interface SidebarResizeHandleProps {
  role: "separator";
  "aria-orientation": "vertical";
  "aria-valuemin": number;
  "aria-valuemax": number;
  "aria-valuenow": number;
  tabIndex: 0;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

function usePointerResize(
  isResizing: boolean,
  dragStartRef: RefObject<DragStart | null>,
  setSidebarWidth: (sidebarWidth: number) => void,
  setIsResizing: (isResizing: boolean) => void,
  persistSidebarWidth: () => void,
): void {
  useEffect(() => {
    if (!isResizing) return;

    document.body.classList.add("sidebar-resizing");
    const handlePointerMove = (event: PointerEvent) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;
      setSidebarWidth(dragStart.width + event.clientX - dragStart.pointerX);
    };
    const stopResize = () => {
      dragStartRef.current = null;
      setIsResizing(false);
      persistSidebarWidth();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      document.body.classList.remove("sidebar-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [isResizing, persistSidebarWidth, setSidebarWidth, setIsResizing, dragStartRef]);
}

/** 目录栏拖拽宽度：拖动中只更新全局 UI 态，结束时才持久化。 */
export function useSidebarResizer(): { sidebarWidth: number; isResizing: boolean; resizeHandleProps: SidebarResizeHandleProps } {
  const sidebarWidth = useUiStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);
  const persistSidebarWidth = useUiStore((state) => state.persistSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<DragStart | null>(null);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const grabOffset = event.clientX - targetRect.left - targetRect.width / 2;
    dragStartRef.current = { pointerX: event.clientX, width: sidebarWidth + grabOffset };
    setIsResizing(true);
  }, [sidebarWidth]);

  const resizeByKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    setSidebarWidth(sidebarWidth + direction * KEYBOARD_RESIZE_STEP);
    persistSidebarWidth();
  }, [persistSidebarWidth, setSidebarWidth, sidebarWidth]);

  usePointerResize(isResizing, dragStartRef, setSidebarWidth, setIsResizing, persistSidebarWidth);

  return {
    sidebarWidth,
    isResizing,
    resizeHandleProps: {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuemin": SIDEBAR_MIN_WIDTH,
      "aria-valuemax": SIDEBAR_MAX_WIDTH,
      "aria-valuenow": sidebarWidth,
      tabIndex: 0,
      onPointerDown: startResize,
      onKeyDown: resizeByKeyboard,
    },
  };
}
