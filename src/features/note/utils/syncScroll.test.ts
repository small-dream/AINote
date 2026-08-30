import { describe, expect, it } from "vitest";
import { lineForPreviewScrollTop, previewScrollTopForLine, type ScrollAnchor } from "./syncScroll";

const anchors: ScrollAnchor[] = [
  { line: 1, top: 0 },
  { line: 5, top: 60 },
  { line: 10, top: 120 },
];

describe("previewScrollTopForLine", () => {
  it("目标行在锚点之间时按比例插值", () => {
    expect(previewScrollTopForLine(anchors, 3)).toBe(30);
  });

  it("目标行恰为锚点行时返回该锚点位置", () => {
    expect(previewScrollTopForLine(anchors, 5)).toBe(60);
  });

  it("目标行在首个锚点之前时落到首个锚点", () => {
    expect(previewScrollTopForLine(anchors, 0)).toBe(0);
  });

  it("目标行在最后锚点之后时落到最后锚点", () => {
    expect(previewScrollTopForLine(anchors, 99)).toBe(120);
  });

  it("无锚点时返回 null", () => {
    expect(previewScrollTopForLine([], 1)).toBeNull();
  });
});

describe("lineForPreviewScrollTop", () => {
  it("滚动位置在锚点之间时插值出行号", () => {
    expect(lineForPreviewScrollTop(anchors, 90)).toBe(8);
  });

  it("滚动位置恰为锚点时返回锚点行号", () => {
    expect(lineForPreviewScrollTop(anchors, 60)).toBe(5);
  });

  it("滚动位置在首个锚点之前时返回首行", () => {
    expect(lineForPreviewScrollTop(anchors, 0)).toBe(1);
  });

  it("滚动位置超过最后锚点时返回最后行号", () => {
    expect(lineForPreviewScrollTop(anchors, 200)).toBe(10);
  });

  it("无锚点时返回 null", () => {
    expect(lineForPreviewScrollTop([], 10)).toBeNull();
  });
});
