import { describe, expect, it } from "vitest";
import { createRangeIndex, isActiveRange } from "./ranges";

describe("isActiveRange", () => {
  it("折叠光标须严格位于元素内部", () => {
    expect(isActiveRange(2, 8, 5)).toBe(true);
    expect(isActiveRange(2, 8, 2)).toBe(false);
    expect(isActiveRange(2, 8, 8)).toBe(false);
    expect(isActiveRange(2, 8, 0)).toBe(false);
  });

  it("选区与元素相交即命中", () => {
    expect(isActiveRange(2, 8, 0, 4)).toBe(true);
    expect(isActiveRange(2, 8, 6, 10)).toBe(true);
    expect(isActiveRange(2, 8, 0, 2)).toBe(false);
    expect(isActiveRange(2, 8, 8, 10)).toBe(false);
  });
});

describe("createRangeIndex", () => {
  it("命中完全包含的区间", () => {
    const index = createRangeIndex([{ from: 3, to: 10 }, { from: 20, to: 30 }]);
    expect(index.contains(4, 9)).toBe(true);
    expect(index.contains(3, 10)).toBe(true);
    expect(index.contains(20, 25)).toBe(true);
  });

  it("未命中部分重叠或越界区间", () => {
    const index = createRangeIndex([{ from: 3, to: 10 }]);
    expect(index.contains(0, 4)).toBe(false);
    expect(index.contains(9, 12)).toBe(false);
    expect(index.contains(0, 12)).toBe(false);
    expect(index.contains(11, 12)).toBe(false);
  });

  it("输入无序时仍按起点排序", () => {
    const index = createRangeIndex([{ from: 20, to: 30 }, { from: 3, to: 10 }]);
    expect(index.contains(5, 8)).toBe(true);
    expect(index.contains(22, 28)).toBe(true);
  });
});
