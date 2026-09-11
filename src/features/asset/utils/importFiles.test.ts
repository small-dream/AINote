import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, splitImageFiles, watchDragInside } from "./importFiles";

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("splitImageFiles", () => {
  it("过滤非图片文件，只保留 image/*", () => {
    const result = splitImageFiles([
      file("a.png", "image/png", 10),
      file("b.txt", "text/plain", 10),
      file("c.jpg", "image/jpeg", 10),
    ]);
    expect(result.images.map((f) => f.name)).toEqual(["a.png", "c.jpg"]);
    expect(result.oversized).toEqual([]);
  });

  it("按默认 20MB 上限分流超大图片", () => {
    const result = splitImageFiles([
      file("ok.png", "image/png", MAX_IMAGE_BYTES),
      file("big.png", "image/png", MAX_IMAGE_BYTES + 1),
    ]);
    expect(result.images.map((f) => f.name)).toEqual(["ok.png"]);
    expect(result.oversized.map((f) => f.name)).toEqual(["big.png"]);
  });

  it("支持自定义上限", () => {
    const result = splitImageFiles([file("m.png", "image/png", 101)], 100);
    expect(result.images).toEqual([]);
    expect(result.oversized).toHaveLength(1);
  });

  it("空输入返回空结果", () => {
    expect(splitImageFiles([])).toEqual({ images: [], oversized: [] });
  });
});

describe("watchDragInside", () => {
  it("dragenter/dragover 视为区域内，dragleave 到外部与 drop 后复位", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const gate = watchDragInside(target);

    expect(gate.isInside()).toBe(false);
    target.dispatchEvent(new Event("dragenter"));
    expect(gate.isInside()).toBe(true);

    // 子元素间移动（relatedTarget 仍在区域内）不清除状态
    const inner = document.createElement("span");
    target.appendChild(inner);
    const leaveInside = new Event("dragleave") as DragEvent;
    Object.defineProperty(leaveInside, "relatedTarget", { value: inner });
    target.dispatchEvent(leaveInside);
    expect(gate.isInside()).toBe(true);

    const leaveOutside = new Event("dragleave") as DragEvent;
    Object.defineProperty(leaveOutside, "relatedTarget", { value: null });
    target.dispatchEvent(leaveOutside);
    expect(gate.isInside()).toBe(false);

    target.dispatchEvent(new Event("dragover"));
    expect(gate.isInside()).toBe(true);
    window.dispatchEvent(new Event("drop"));
    expect(gate.isInside()).toBe(false);

    gate.dispose();
    target.remove();
  });

  it("dispose 后不再更新状态", () => {
    const target = document.createElement("div");
    const gate = watchDragInside(target);
    gate.dispose();
    target.dispatchEvent(new Event("dragenter"));
    expect(gate.isInside()).toBe(false);
  });
});
