import { scrollLeftForThumbOffset } from "@/features/code-block/utils/horizontalScrollbar";
import type { CodeLineMetrics } from "./editCodeBlockScrollbarMetrics";

const KEYBOARD_STEP = 48;

interface DragState {
  pointerId: number;
  startX: number;
  startScroll: number;
}

interface PointerOptions {
  track: HTMLElement;
  thumb: HTMLElement;
  readMetrics: () => CodeLineMetrics;
  setScroll: (left: number) => void;
}

/** 绑定底部滚动条的拖拽、点击轨道与键盘操作。 */
export function attachScrollbarPointers(options: PointerOptions): () => void {
  const drag: { current: DragState | null } = { current: null };
  const onThumbDown = (event: PointerEvent) => startDrag(event, options, drag);
  const onThumbMove = (event: PointerEvent) => moveDrag(event, options, drag);
  const onThumbUp = (event: PointerEvent) => endDrag(event, options.thumb, drag);
  const onTrackDown = (event: PointerEvent) => jumpToTrack(event, options);
  const onKeyDown = (event: KeyboardEvent) => handleKey(event, options);
  options.thumb.addEventListener("pointerdown", onThumbDown);
  options.thumb.addEventListener("pointermove", onThumbMove);
  options.thumb.addEventListener("pointerup", onThumbUp);
  options.thumb.addEventListener("pointercancel", onThumbUp);
  options.track.addEventListener("pointerdown", onTrackDown);
  options.track.addEventListener("keydown", onKeyDown);
  return () => {
    options.thumb.removeEventListener("pointerdown", onThumbDown);
    options.thumb.removeEventListener("pointermove", onThumbMove);
    options.thumb.removeEventListener("pointerup", onThumbUp);
    options.thumb.removeEventListener("pointercancel", onThumbUp);
    options.track.removeEventListener("pointerdown", onTrackDown);
    options.track.removeEventListener("keydown", onKeyDown);
  };
}

function startDrag(event: PointerEvent, options: PointerOptions, drag: { current: DragState | null }): void {
  event.preventDefault();
  event.stopPropagation();
  options.thumb.setPointerCapture(event.pointerId);
  const metrics = options.readMetrics();
  drag.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: metrics.scrollLeft };
  options.thumb.dataset.maxScroll = String(Math.max(0, metrics.content - metrics.viewport));
}

function moveDrag(event: PointerEvent, options: PointerOptions, drag: { current: DragState | null }): void {
  const state = drag.current;
  if (!state || state.pointerId !== event.pointerId) return;
  const travel = options.track.clientWidth - options.thumb.getBoundingClientRect().width;
  const maxScroll = Number(options.thumb.dataset.maxScroll ?? 0);
  if (travel <= 0 || maxScroll <= 0) return;
  const delta = ((event.clientX - state.startX) * maxScroll) / travel;
  options.setScroll(Math.min(maxScroll, Math.max(0, state.startScroll + delta)));
}

function endDrag(event: PointerEvent, thumb: HTMLElement, drag: { current: DragState | null }): void {
  if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
  drag.current = null;
}

function jumpToTrack(event: PointerEvent, options: PointerOptions): void {
  if (event.target !== options.track) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = options.track.getBoundingClientRect();
  const metrics = options.readMetrics();
  const thumbWidth = options.thumb.getBoundingClientRect().width;
  const offset = event.clientX - rect.left - thumbWidth / 2;
  options.setScroll(scrollLeftForThumbOffset(offset, metrics.viewport, metrics.content));
}

function handleKey(event: KeyboardEvent, options: PointerOptions): void {
  const maxScroll = Number(options.track.getAttribute("aria-valuemax") ?? 0);
  const current = options.readMetrics().scrollLeft;
  const target = event.key === "ArrowLeft" ? Math.max(0, current - KEYBOARD_STEP)
    : event.key === "ArrowRight" ? Math.min(maxScroll, current + KEYBOARD_STEP)
      : event.key === "Home" ? 0
        : event.key === "End" ? maxScroll
          : null;
  if (target === null) return;
  event.preventDefault();
  options.setScroll(target);
}
