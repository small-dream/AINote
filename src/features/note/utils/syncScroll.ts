/** 分栏同步滚动：Markdown 行号 ↔ 预览滚动位置的双向映射（纯函数，无副作用） */

export interface ScrollAnchor {
  /** Markdown 源码行号（1 基，取自 mdast position.start.line） */
  line: number;
  /** 预览中块相对内容顶部的 Y 坐标 */
  top: number;
}

/**
 * 给定目标 Markdown 行号，返回预览应滚动到的位置。
 * 锚点须按行号升序（DOM 顺序天然满足）；取该行前后最近的锚点线性插值，越界落到最近锚点。
 */
export function previewScrollTopForLine(anchors: ScrollAnchor[], line: number): number | null {
  const first = anchors[0];
  if (!first) return null;
  if (line <= first.line) return first.top;
  let prev = first;
  let next: ScrollAnchor | null = null;
  for (const a of anchors) {
    if (a.line > line) {
      next = a;
      break;
    }
    prev = a;
  }
  if (!next) return prev.top;
  const span = next.line - prev.line;
  const progress = span <= 0 ? 0 : (line - prev.line) / span;
  return prev.top + (next.top - prev.top) * progress;
}

/**
 * 给定预览滚动位置，返回编辑器应对齐的 Markdown 行号。
 * 锚点须按 top 升序；取该位置前后最近的锚点线性插值后取整，越界落到最近锚点。
 */
export function lineForPreviewScrollTop(anchors: ScrollAnchor[], scrollTop: number): number | null {
  const first = anchors[0];
  if (!first) return null;
  if (scrollTop <= first.top) return first.line;
  let prev = first;
  let next: ScrollAnchor | null = null;
  for (const a of anchors) {
    if (a.top > scrollTop) {
      next = a;
      break;
    }
    prev = a;
  }
  if (!next) return prev.line;
  const span = next.top - prev.top;
  const progress = span <= 0 ? 0 : (scrollTop - prev.top) / span;
  return Math.round(prev.line + progress * (next.line - prev.line));
}
