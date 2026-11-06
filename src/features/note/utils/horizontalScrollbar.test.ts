import { describe, expect, it } from "vitest";
import { horizontalScrollbarMetrics, scrollLeftForThumbOffset } from "./horizontalScrollbar";

describe("horizontalScrollbarMetrics", () => {
  it("内容未溢出时隐藏滚动条", () => {
    expect(horizontalScrollbarMetrics(320, 320, 0)).toEqual({
      visible: false,
      maxScroll: 0,
      thumbWidth: 320,
      thumbOffset: 0,
    });
  });

  it("按可视比例计算滑块宽度与位置", () => {
    const metrics = horizontalScrollbarMetrics(300, 900, 300);
    expect(metrics.visible).toBe(true);
    expect(metrics.maxScroll).toBe(600);
    expect(metrics.thumbWidth).toBe(100);
    expect(metrics.thumbOffset).toBe(100);
  });

  it("超长内容保持最小滑块宽度，并夹紧滚动位置", () => {
    const metrics = horizontalScrollbarMetrics(300, 30000, 99999);
    expect(metrics.thumbWidth).toBe(32);
    expect(metrics.thumbOffset).toBe(268);
  });
});

describe("scrollLeftForThumbOffset", () => {
  it("轨道起止位置对应内容起止位置", () => {
    expect(scrollLeftForThumbOffset(0, 300, 900)).toBe(0);
    expect(scrollLeftForThumbOffset(200, 300, 900)).toBe(600);
  });

  it("无溢出时返回零", () => {
    expect(scrollLeftForThumbOffset(20, 300, 300)).toBe(0);
  });
});
