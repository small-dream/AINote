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

export function applyCodeBlockScrollbar(track: HTMLElement, thumb: HTMLElement, metrics: CodeLineMetrics): void {
  const bar = horizontalScrollbarMetrics(metrics.viewport, metrics.content, metrics.scrollLeft);
  track.setAttribute("aria-valuemax", String(Math.round(bar.maxScroll)));
  track.setAttribute("aria-valuenow", String(Math.round(metrics.scrollLeft)));
  track.setAttribute("aria-hidden", String(!bar.visible));
  track.tabIndex = bar.visible ? 0 : -1;
  track.classList.toggle("is-overflowing", bar.visible);
  track.parentElement?.classList.toggle("is-empty", !bar.visible);
  thumb.style.width = bar.thumbWidth + "px";
  thumb.style.transform = "translateX(" + bar.thumbOffset + "px)";
}

export function scrollCodeLines(items: HTMLElement[], left: number): void {
  for (const line of items) line.scrollLeft = left;
}
