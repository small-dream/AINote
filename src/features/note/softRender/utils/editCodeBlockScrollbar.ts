import type { EditorView } from "@codemirror/view";
import {
  applyCodeBlockScrollbar,
  readCodeLineMetrics,
  scrollCodeLines,
} from "./editCodeBlockScrollbarMetrics";
import { attachScrollbarPointers } from "./editCodeBlockScrollbarPointer";

/** 把编辑态各代码行的横向滚动同步到同一条底部轨道。 */
export function attachEditCodeBlockScrollbar(
  track: HTMLElement,
  thumb: HTMLElement,
  view: EditorView,
): () => void {
  let syncing = false;
  const readMetrics = () => readCodeLineMetrics(view);
  const refresh = () => applyCodeBlockScrollbar(track, thumb, readMetrics());
  const setScroll = (left: number) => {
    if (syncing) return;
    syncing = true;
    scrollCodeLines(readMetrics().items, left);
    refresh();
    setTimeout(() => { syncing = false; }, 0);
  };
  const detachPointers = attachScrollbarPointers({ track, thumb, readMetrics, setScroll });
  const onScroll = (event: Event) => {
    const target = event.target;
    if (syncing || !(target instanceof HTMLElement)) return;
    if (!target.classList.contains("cm-sr-codeblock-body")) return;
    setScroll(target.scrollLeft);
  };
  view.contentDOM.addEventListener("scroll", onScroll, true);
  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(refresh);
  observer?.observe(view.contentDOM, { childList: true, subtree: true, characterData: true });
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
  if (resizeObserver) {
    resizeObserver.observe(view.contentDOM);
    for (const line of readMetrics().items) resizeObserver.observe(line);
  }
  refresh();
  return () => {
    detachPointers();
    view.contentDOM.removeEventListener("scroll", onScroll, true);
    observer?.disconnect();
    resizeObserver?.disconnect();
  };
}
