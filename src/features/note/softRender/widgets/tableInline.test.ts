import { beforeEach, describe, expect, it } from "vitest";
import { renderTableInline, sourceOffsetAtRendered } from "./tableInline";
import { labelKey } from "../utils/footnotes";

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

describe("tableInline 单元格脚注引用", () => {
  it("查得到编号的 [^label] 渲染为 [n] 节点（大小写归一）", () => {
    const el = document.createElement("div");
    renderTableInline(el, "甲 [^NOTE] 乙", new Map([[labelKey("NOTE"), "1"]]));
    expect(el.textContent).toBe("甲 [1] 乙");
    expect(el.querySelector(".cm-sr-footnote-ref")?.textContent).toBe("[1]");
  });

  it("查不到编号或没有查号表时保持源码", () => {
    const missing = document.createElement("div");
    renderTableInline(missing, "甲 [^x] 乙", new Map());
    expect(missing.textContent).toBe("甲 [^x] 乙");

    const noMap = document.createElement("div");
    renderTableInline(noMap, "甲 [^x] 乙");
    expect(noMap.textContent).toBe("甲 [^x] 乙");
  });

  it("行内代码内的 [^x] 保持字面文本", () => {
    const el = document.createElement("div");
    renderTableInline(el, "`[^x]`", new Map([[labelKey("x"), "1"]]));
    expect(el.querySelector("code")?.textContent).toBe("[^x]");
    expect(el.querySelector(".cm-sr-footnote-ref")).toBeNull();
  });

  it("序号区域映射回引用源码", () => {
    const el = document.createElement("div");
    renderTableInline(el, "a [^x] b", new Map([[labelKey("x"), "12"]]));
    // 渲染文本 "a [12] b"：序号区（渲染偏移 2–5）线性映射回 `[^x]` 源码（偏移 2 起）。
    expect(sourceOffsetAtRendered(el, 0)).toBe(0);
    expect(sourceOffsetAtRendered(el, 3)).toBe(3);
    expect(sourceOffsetAtRendered(el, 5)).toBe(5);
    expect(sourceOffsetAtRendered(el, 6)).toBe(6);
    expect(sourceOffsetAtRendered(el, 8)).toBe(8);
  });
});
