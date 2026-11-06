import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { scrollLeftForThumbOffset } from "../utils/horizontalScrollbar";

interface DragState {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
}

interface ScrollControlsOptions {
  thumbWidth: number;
  maxScroll: number;
}

const KEYBOARD_STEP = 48;

/** 自定义横向滚动条的鼠标拖动、轨道点击与键盘控制。 */
export function useCodeBlockScrollControls(
  preRef: RefObject<HTMLPreElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  { thumbWidth, maxScroll }: ScrollControlsOptions,
) {
  const dragRef = useRef<DragState | null>(null);

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pre = preRef.current;
    if (!pre) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: pre.scrollLeft };
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pre = preRef.current;
    const track = trackRef.current;
    const drag = dragRef.current;
    if (!pre || !track || !drag || drag.pointerId !== event.pointerId) return;
    const travel = track.clientWidth - thumbWidth;
    if (travel <= 0) return;
    const next = drag.startScrollLeft + ((event.clientX - drag.startX) * maxScroll) / travel;
    pre.scrollLeft = Math.min(maxScroll, Math.max(0, next));
    pre.dispatchEvent(new Event("scroll"));
  };

  const endThumbDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const pre = preRef.current;
    const track = trackRef.current;
    if (!pre || !track) return;
    event.preventDefault();
    const rect = track.getBoundingClientRect();
    const offset = event.clientX - rect.left - thumbWidth / 2;
    pre.scrollTo({ left: scrollLeftForThumbOffset(offset, pre.clientWidth, pre.scrollWidth), behavior: "smooth" });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pre = preRef.current;
    if (!pre) return;
    const target = keyboardTarget(event.key, pre.scrollLeft, maxScroll);
    if (target === null) return;
    event.preventDefault();
    pre.scrollTo({ left: target, behavior: "smooth" });
  };

  return {
    handleThumbPointerDown,
    handleThumbPointerMove,
    endThumbDrag,
    handleTrackPointerDown,
    handleKeyDown,
    clearDrag: () => { dragRef.current = null; },
  };
}

function keyboardTarget(key: string, current: number, maxScroll: number): number | null {
  if (key === "ArrowLeft") return Math.max(0, current - KEYBOARD_STEP);
  if (key === "ArrowRight") return Math.min(maxScroll, current + KEYBOARD_STEP);
  if (key === "Home") return 0;
  if (key === "End") return maxScroll;
  return null;
}
