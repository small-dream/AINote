import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD = 10;

interface LongPressContextMenuOptions {
  /** 子区域需要接管长按时，阻止同一事件再次触发外层长按。 */
  stopPropagation?: boolean | undefined;
}

/** 移动端没有稳定 contextmenu；触屏长按转发为菜单打开事件，同时不干扰滚动与原生选择 */
export function useLongPressContextMenu(onOpen: (point: { x: number; y: number }) => void, { stopPropagation = false }: LongPressContextMenuOptions = {}) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (stopPropagation) event.stopPropagation();
    if (event.pointerType !== "touch") return;
    originRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => onOpen({ x: event.clientX, y: event.clientY }), LONG_PRESS_MS);
  }, [onOpen, stopPropagation]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (stopPropagation) event.stopPropagation();
    const origin = originRef.current;
    if (!origin || timerRef.current === null) return;
    const moved = Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
    if (moved <= MOVE_THRESHOLD) return;
    cancel();
  }, [cancel, stopPropagation]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}
