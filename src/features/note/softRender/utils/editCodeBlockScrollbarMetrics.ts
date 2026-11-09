import type { EditorView } from "@codemirror/view";
import { horizontalScrollbarMetrics } from "@/features/code-block/utils/horizontalScrollbar";

export interface CodeLineMetrics {
  items: HTMLElement[];
  viewport: number;
  content: number;
  scrollLeft: number;
}

export function readCodeLineMetrics(view: EditorView): CodeLineMetrics {
  const items = Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-sr-codeblock-body"));
  const viewport = items[0]?.clientWidth ?? 0;
  const content = items.reduce((width, line) => Math.max(width, line.scrollWidth), viewport);
  return { items, viewport, content, scrollLeft: items[0]?.scrollLeft ?? 0 };
}

/**
 * 把测量结果写到轨道/滑块上，返回底部留白是否在 12px 与 30px 之间切换。
 * 该切换会改变卡片高度，调用方需要通知 CodeMirror 重新测量，否则高度表失真。
 */
export function applyCodeBlockScrollbar(track: HTMLElement, thumb: HTMLElement, metrics: CodeLineMetrics): boolean {
  const bar = horizontalScrollbarMetrics(metrics.viewport, metrics.content, metrics.scrollLeft);
  track.setAttribute("aria-valuemax", String(Math.round(bar.maxScroll)));
  track.setAttribute("aria-valuenow", String(Math.round(metrics.scrollLeft)));
  track.setAttribute("aria-hidden", String(!bar.visible));
  track.tabIndex = bar.visible ? 0 : -1;
  track.classList.toggle("is-overflowing", bar.visible);
  const host = track.parentElement;
  const empty = !bar.visible;
  const heightChanged = host ? host.classList.contains("is-empty") !== empty : false;
  host?.classList.toggle("is-empty", empty);
  thumb.style.width = bar.thumbWidth + "px";
  thumb.style.transform = "translateX(" + bar.thumbOffset + "px)";
  return heightChanged;
}

export function scrollCodeLines(items: HTMLElement[], left: number): void {
  for (const line of items) line.scrollLeft = left;
}
