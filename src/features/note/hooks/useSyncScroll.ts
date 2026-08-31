import { useEffect } from "react";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import type { ViewMode } from "../components/EditorToolbar";
import {
  lineForPreviewScrollTop,
  previewScrollTopForLine,
  type ScrollAnchor,
} from "../utils/syncScroll";

/**
 * 分栏模式下编辑/预览双向同步滚动（锚点插值），仅在 mode === "split" 时生效（P0-2）。
 * 必须直接依赖 view 实例而非就绪布尔值：模式切换会重挂载 CodeMirror，
 * 只有 view 引用变化才能让 effect 用新实例重新绑定。
 */
export function useSyncScroll(
  view: EditorView | null,
  previewRef: RefObject<HTMLDivElement | null>,
  mode: ViewMode
) {
  useEffect(() => {
    if (mode !== "split" || !view) return;
    const preview = previewRef.current;
    if (!preview) return;
    return attachSyncScroll(view, preview);
  }, [view, previewRef, mode]);
}

function collectAnchors(preview: HTMLDivElement): ScrollAnchor[] {
  const containerTop = preview.getBoundingClientRect().top - preview.scrollTop;
  return Array.from(preview.querySelectorAll<HTMLElement>("[data-line]")).flatMap((el) => {
    const line = Number(el.dataset.line);
    if (!Number.isFinite(line)) return [];
    const top = el.getBoundingClientRect().top - containerTop;
    return [{ line, top }];
  });
}

interface ScrollTarget {
  value: number | null;
}

/** scroll 事件异步派发：程序化赋值引发的回声事件，其 scrollTop 必等于记录的实际落点（事件按帧合并） */
function isProgrammaticEcho(target: ScrollTarget, current: number): boolean {
  if (target.value === null) return false;
  const echo = Math.abs(current - target.value) <= 1;
  target.value = null;
  return echo;
}

function scrollTo(el: HTMLElement, top: number, target: ScrollTarget): void {
  if (Math.abs(el.scrollTop - top) <= 1) return;
  el.scrollTop = top;
  target.value = el.scrollTop; // 读回实际落点（浏览器取整/clamp 后的值）
}

export function attachSyncScroll(view: EditorView, preview: HTMLDivElement): () => void {
  const runtime = createSyncRuntime(view, preview);
  view.scrollDOM.addEventListener("scroll", runtime.fromEditor);
  preview.addEventListener("scroll", runtime.fromPreview);
  return () => {
    runtime.dispose();
    view.scrollDOM.removeEventListener("scroll", runtime.fromEditor);
    preview.removeEventListener("scroll", runtime.fromPreview);
  };
}

function createSyncRuntime(view: EditorView, preview: HTMLDivElement) {
  const editorTarget: ScrollTarget = { value: null };
  const previewTarget: ScrollTarget = { value: null };
  let anchors: ScrollAnchor[] = [];
  let frame: number | null = null;
  let disposed = false;

  const syncFromEditor = () => syncEditor(view, preview, anchors, editorTarget, previewTarget);
  const syncFromPreview = () => syncPreview(view, preview, anchors, previewTarget, editorTarget);

  const schedule = (callback: () => void) => scheduleFrame(callback, () => { frame = null; }, () => disposed, (id) => { frame = id; }, frame);
  const fromEditor = () => schedule(syncFromEditor);
  const fromPreview = () => schedule(syncFromPreview);

  anchors = collectAnchors(preview);
  const observer = new MutationObserver(() => { anchors = collectAnchors(preview); });
  observer.observe(preview, { childList: true, subtree: true });
  const resizeObserver = observeResize(preview, () => { anchors = collectAnchors(preview); });
  return {
    fromEditor,
    fromPreview,
    dispose: () => {
    disposed = true;
    if (frame !== null) {
      const cancel = globalThis.cancelAnimationFrame ?? globalThis.clearTimeout;
      cancel(frame);
    }
    observer.disconnect();
    resizeObserver?.disconnect();
    },
  };
}

function scheduleFrame(callback: () => void, clear: () => void, isDisposed: () => boolean, set: (id: number) => void, frame: number | null): void {
  if (frame !== null) return;
  const isTestRuntime = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
  if (!globalThis.requestAnimationFrame || isTestRuntime) { callback(); return; }
  const id = globalThis.requestAnimationFrame(() => { clear(); if (!isDisposed()) callback(); });
  set(id);
}

function observeResize(element: HTMLDivElement, callback: () => void): ResizeObserver | null {
  if (typeof ResizeObserver === "undefined") return null;
  const observer = new ResizeObserver(callback);
  observer.observe(element);
  return observer;
}

function syncEditor(view: EditorView, preview: HTMLDivElement, anchors: ScrollAnchor[], source: ScrollTarget, target: ScrollTarget): void {
  if (isProgrammaticEcho(source, view.scrollDOM.scrollTop)) return;
  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
  const line = view.state.doc.lineAt(block.from).number;
  const top = previewScrollTopForLine(anchors, line);
  if (top !== null) scrollTo(preview, top, target);
}

function syncPreview(view: EditorView, preview: HTMLDivElement, anchors: ScrollAnchor[], source: ScrollTarget, target: ScrollTarget): void {
  if (isProgrammaticEcho(source, preview.scrollTop)) return;
  const line = lineForPreviewScrollTop(anchors, preview.scrollTop);
  if (line === null) return;
  const block = view.lineBlockAt(view.state.doc.line(line).from);
  scrollTo(view.scrollDOM, block.top, target);
}
