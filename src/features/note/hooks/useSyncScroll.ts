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
  const editorTarget: ScrollTarget = { value: null };
  const previewTarget: ScrollTarget = { value: null };
  let anchors: ScrollAnchor[] = [];

  const fromEditor = () => {
    if (isProgrammaticEcho(editorTarget, view.scrollDOM.scrollTop)) return;
    const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
    const line = view.state.doc.lineAt(block.from).number;
    const target = previewScrollTopForLine(anchors, line);
    if (target === null) return;
    scrollTo(preview, target, previewTarget);
  };

  const fromPreview = () => {
    if (isProgrammaticEcho(previewTarget, preview.scrollTop)) return;
    const line = lineForPreviewScrollTop(anchors, preview.scrollTop);
    if (line === null) return;
    const block = view.lineBlockAt(view.state.doc.line(line).from);
    scrollTo(view.scrollDOM, block.top, editorTarget);
  };

  anchors = collectAnchors(preview);
  const observer = new MutationObserver(() => {
    anchors = collectAnchors(preview);
  });
  observer.observe(preview, { childList: true, subtree: true });
  view.scrollDOM.addEventListener("scroll", fromEditor);
  preview.addEventListener("scroll", fromPreview);

  return () => {
    observer.disconnect();
    view.scrollDOM.removeEventListener("scroll", fromEditor);
    preview.removeEventListener("scroll", fromPreview);
  };
}
