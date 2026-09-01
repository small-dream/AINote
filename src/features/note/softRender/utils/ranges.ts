import type { TextRange } from "../types";

export interface RangeIndex {
  contains: (from: number, to: number) => boolean;
}

/** 有序保护区索引：按起点排序后二分定位，避免大文档下的线性扫描（O(n²)）。 */
export function createRangeIndex(ranges: TextRange[]): RangeIndex {
  const sorted = ranges.slice().sort((a, b) => a.from - b.from || a.to - b.to);
  return { contains: (from, to) => containedInSorted(from, to, sorted) };
}

function containedInSorted(from: number, to: number, sorted: TextRange[]): boolean {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const range = sorted[mid];
    if (!range) return false;
    if (range.from <= from) {
      if (range.to >= to) return true;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return false;
}

/** 光标/选区是否命中元素：折叠光标须严格位于元素内部，选区与元素相交即可。 */
export function isActiveRange(from: number, to: number, cursor: number, selectionTo?: number): boolean {
  if (selectionTo === undefined) return cursor > from && cursor < to;
  const start = Math.min(cursor, selectionTo);
  const end = Math.max(cursor, selectionTo);
  return start < to && end > from;
}
