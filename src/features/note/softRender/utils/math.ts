import katex from "katex";
import "katex/dist/katex.min.css";
import type { RangeIndex } from "./ranges";

export type MathMode = "inline" | "block";

export interface MathRange {
  from: number;
  to: number;
  source: string;
  mode: MathMode;
}

const INLINE_MATH_RE = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
const BLOCK_MATH_RE = /\$\$([\s\S]+?)\$\$/g;

/** 从文档中提取 KaTeX 数学公式范围，避开已受保护区间。 */
export function findMathRanges(doc: string, protectedRanges: RangeIndex): MathRange[] {
  const ranges: MathRange[] = [];
  collectMathRanges(doc, protectedRanges, BLOCK_MATH_RE, "block", ranges);
  collectMathRanges(doc, protectedRanges, INLINE_MATH_RE, "inline", ranges);
  return ranges.sort((a, b) => a.from - b.from);
}

function collectMathRanges(
  doc: string,
  protectedRanges: RangeIndex,
  regex: RegExp,
  mode: MathMode,
  out: MathRange[],
): void {
  for (const match of doc.matchAll(regex)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (protectedRanges.contains(from, to)) continue;
    out.push({ from, to, source: match[1] ?? "", mode });
  }
}

/** 把数学源码渲染为 KaTeX DOM。 */
export function renderMath(source: string, mode: MathMode): HTMLElement {
  const el = document.createElement(mode === "block" ? "div" : "span");
  el.className = `cm-sr-math cm-sr-math-${mode}`;
  try {
    katex.render(source, el, { displayMode: mode === "block", throwOnError: false });
  } catch {
    el.textContent = source;
  }
  return el;
}
