import { describe, expect, it } from "vitest";
import { BulletWidget } from "./inline";

describe("BulletWidget", () => {
  it("根节点保留行盒高度与源码区间，放大只作用在内层圆点", () => {
    const el = new BulletWidget(0, 2).toDOM();

    // 点击进入编辑依赖根节点上的源码区间
    expect(el.className).toBe("cm-sr-bullet");
    expect(el.dataset.srFrom).toBe("0");
    expect(el.dataset.srTo).toBe("2");

    // CodeMirror 取 widget 根节点的矩形作为「光标停在列表标记处」的几何：
    // 放大若落在根节点上（.cm-sr-bullet 直接 scale），光标会被撑到行高的 1.7 倍。
    // 因此缩放必须留在内层 dot 上，根节点只做占位。
    const dot = el.querySelector<HTMLElement>(".cm-sr-bullet-dot");
    expect(dot).not.toBeNull();
    expect(dot?.textContent).toBe("•");
    expect(dot?.parentElement).toBe(el);
  });
});
