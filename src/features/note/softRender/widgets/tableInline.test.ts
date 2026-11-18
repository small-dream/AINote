import { beforeEach, describe, expect, it } from "vitest";
import { renderTableInline, sourceOffsetAtRendered } from "./tableInline";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("tableInline 行内渲染", () => {
  it("渲染加粗与行内代码并隐藏标记", () => {
    const el = document.createElement("div");
    renderTableInline(el, "前 **经典** 后 `cutout`");
    expect(el.textContent).toBe("前 经典 后 cutout");
    expect(el.querySelector("strong")?.textContent).toBe("经典");
    expect(el.querySelector("code")?.textContent).toBe("cutout");
  });

  it("把渲染文本偏移映射回 Markdown 源码偏移", () => {
    const el = document.createElement("div");
    renderTableInline(el, "前 **经典** 后 `cutout`");
    expect(sourceOffsetAtRendered(el, 0)).toBe(0);
    expect(sourceOffsetAtRendered(el, 2)).toBe(4);
    expect(sourceOffsetAtRendered(el, 3)).toBe(5);
    expect(sourceOffsetAtRendered(el, 7)).toBe(12);
    expect(sourceOffsetAtRendered(el, 13)).toBe(18);
  });

  it("越界偏移按渲染文本长度夹紧", () => {
    const el = document.createElement("div");
    renderTableInline(el, "**a**");
    expect(sourceOffsetAtRendered(el, -4)).toBe(2);
    expect(sourceOffsetAtRendered(el, 99)).toBe(3);
  });

  it("转义字符显示字面值但仍映射到源码位置", () => {
    const el = document.createElement("div");
    renderTableInline(el, "a \\* b");
    expect(el.textContent).toBe("a * b");
    expect(sourceOffsetAtRendered(el, 2)).toBe(3);
  });

  it("行内代码中的 Markdown 标记保持字面文本", () => {
    const el = document.createElement("div");
    renderTableInline(el, "`a **b** c`");
    expect(el.querySelector("strong")).toBeNull();
    expect(el.querySelector("code")?.textContent).toBe("a **b** c");
    expect(sourceOffsetAtRendered(el, 0)).toBe(1);
  });

  it("未渲染过的元素返回 null", () => {
    expect(sourceOffsetAtRendered(document.createElement("div"), 0)).toBeNull();
  });
});
