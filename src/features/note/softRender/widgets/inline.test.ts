import { describe, expect, it } from "vitest";
import { BulletWidget, FootnoteDefWidget, FootnoteRefWidget, NumberWidget } from "./inline";

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

describe("NumberWidget", () => {
  it("嵌套有序列表使用 lower-roman / lower-alpha 标记", () => {
    expect(new NumberWidget(0, 2, 4).toDOM().textContent).toBe("4.");
    expect(new NumberWidget(0, 2, 4, "lower-roman").toDOM().textContent).toBe("iv.");
    expect(new NumberWidget(0, 2, 2, "lower-alpha").toDOM().textContent).toBe("b.");
  });
});

describe("Footnote widgets", () => {
  it("引用显示为 [n]，定义显示为 n.，并保留源码区间", () => {
    const ref = new FootnoteRefWidget(2, 6, 1).toDOM();
    expect(ref.className).toBe("cm-sr-footnote-ref");
    expect(ref.textContent).toBe("[1]");
    expect(ref.dataset.srFrom).toBe("2");

    const definition = new FootnoteDefWidget(8, 14, "2").toDOM();
    expect(definition.className).toBe("cm-sr-footnote-label");
    expect(definition.textContent).toBe("2.");
    expect(definition.dataset.srTo).toBe("14");
  });
});
