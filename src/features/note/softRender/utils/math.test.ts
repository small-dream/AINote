import { describe, expect, it } from "vitest";
import { findMathRanges } from "./math";
import { createRangeIndex } from "./ranges";

describe("findMathRanges", () => {
  it("识别行内与块级公式", () => {
    const doc = "x = $a + b$\n\n$$y = c$$";
    const ranges = findMathRanges(doc, createRangeIndex([]));
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({ mode: "inline", source: "a + b" });
    expect(ranges[1]).toMatchObject({ mode: "block", source: "y = c" });
  });

  it("跳过受保护区间", () => {
    const doc = "`$skip$` $keep$";
    const ranges = findMathRanges(doc, createRangeIndex([{ from: 0, to: 8 }]));
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ source: "keep" });
  });
});
