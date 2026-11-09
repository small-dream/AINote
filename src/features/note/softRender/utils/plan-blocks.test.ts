import { parser, GFM } from "@lezer/markdown";
import type { Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./plan";
import type { SoftRenderPlan } from "../types";

const md = parser.configure([GFM]);

function planFor(text: string, cursor: number, selectionTo?: number): SoftRenderPlan {
  const tree: Tree = md.parse(text);
  return planSoftRender(tree, text, cursor, selectionTo);
}

function findMark(plan: SoftRenderPlan, cls: string) {
  return plan.marks.find((m) => m.cls === cls);
}

describe("planSoftRender 标题", () => {
  it("光标在行外隐藏 #，行内淡显并放大标题", () => {
    const text = "# Title\n\nbody";
    const hidden = planFor(text, text.length - 1);
    expect(findMark(hidden, "cm-sr-h1")).toMatchObject({ from: 1, to: 7 });
    expect(hidden.hides.find((h) => h.from === 0)).toMatchObject({ to: 1, reveal: false });
    const active = planFor(text, 3);
    expect(active.hides.find((h) => h.from === 0)?.reveal).toBe(true);
  });

  it("Setext 标题隐藏下划线并按级别放大", () => {
    const text = "Title\n=====";
    const hidden = planFor(text, 0);
    expect(findMark(hidden, "cm-sr-h1")).toMatchObject({ from: 0, to: 6 });
    expect(hidden.hides.find((h) => h.from === 6)?.reveal).toBe(false);
    const active = planFor(text, 2);
    expect(active.hides.find((h) => h.from === 6)?.reveal).toBe(true);
  });

  it("选区命中标题时淡显标记", () => {
    const text = "# Title\n\nbody";
    const plan = planFor(text, 0, 4);
    expect(plan.hides.find((h) => h.from === 0)?.reveal).toBe(true);
  });
});

describe("planSoftRender 代码块与引用", () => {
  it("围栏代码块光标离开时渲染为 widget，进入时隐藏围栏（光标不在围栏行上）", () => {
    const text = "before\n\n```js\nconst a = 1;\n```";
    const plan = planFor(text, 0);
    expect(plan.widgets.find((w) => w.kind === "codeblock")).toMatchObject({ alt: "js", value: "const a = 1;", caret: 14 });
    // 光标在代码正文里：两条围栏都隐藏（替换为空，DOM 里看不到 ```）。
    const active = planFor(text, 15);
    expect(active.hides.filter((h) => h.from >= 8 && h.to <= 13).every((h) => !h.reveal)).toBe(true);
    expect(active.hides.find((h) => h.from === 27)?.reveal).toBe(false);
    expect(active.gaps.filter((gap) => gap.cls.startsWith("cm-sr-codeblock-line")).map((gap) => gap.cls)).toEqual([
      "cm-sr-codeblock-line cm-sr-codeblock-line-first",
      "cm-sr-codeblock-line cm-sr-codeblock-body cm-sr-codeblock-body-first",
      "cm-sr-codeblock-line cm-sr-codeblock-line-last",
    ]);
    expect(active.widgets.map((widget) => widget.kind)).toEqual([
      "codeblock-edit-header",
      "codeblock-edit-scrollbar",
    ]);
  });

  it("光标落在开围栏行上时只淡显该围栏", () => {
    const text = "before\n\n```js\nconst a = 1;\n```";
    const active = planFor(text, 9);
    expect(active.hides.find((h) => h.from === 8)?.reveal).toBe(true);
    expect(active.hides.find((h) => h.from === 11)?.reveal).toBe(true);
    expect(active.hides.find((h) => h.from === 27)?.reveal).toBe(false);
  });

  it("光标落在围栏行边界时仍隐藏围栏，避免点击留白冒出 ```", () => {
    const text = "before\n\n```js\nconst a = 1;\n```";
    const openingBoundary = planFor(text, 13);
    expect(openingBoundary.hides.find((h) => h.from === 8)?.reveal).toBe(false);
    const closingBoundary = planFor(text, 27);
    expect(closingBoundary.hides.find((h) => h.from === 27)?.reveal).toBe(false);
    // 光标真正进入围栏行内部时仍淡显，保留键盘编辑源码围栏的能力。
    expect(planFor(text, 9).hides.find((h) => h.from === 8)?.reveal).toBe(true);
  });

  it("选区跨过围栏时仍隐藏围栏和语言标记", () => {
    const text = "```js\nconst a = 1;\n```";
    const active = planFor(text, 0, 22);
    expect(active.hides).toHaveLength(3);
    expect(active.hides.every((h) => !h.reveal)).toBe(true);
  });

  it("引用块隐藏 > 前缀", () => {
    const text = "before\n\n> quote\n> more";
    const plan = planFor(text, 0);
    expect(plan.blocks.some((b) => b.cls === "cm-sr-blockquote")).toBe(true);
    expect(plan.hides.find((h) => h.from === 8)?.reveal).toBe(false);
    const active = planFor(text, 10);
    expect(active.hides.find((h) => h.from === 8)?.reveal).toBe(true);
  });

  it("Callout 隐藏 [!NOTE] 标记并套用样式", () => {
    const text = "> [!NOTE] hi";
    const plan = planFor(text, 0);
    expect(plan.blocks.some((b) => b.cls.includes("cm-sr-callout-note"))).toBe(true);
    expect(plan.hides.some((h) => h.from === 2 && h.to === 10 && !h.reveal)).toBe(true);
  });

  it("Callout 光标在内时淡显 [!NOTE] 标记", () => {
    const text = "> [!NOTE] hi";
    const active = planFor(text, 3);
    expect(active.hides.find((h) => h.from === 2 && h.to === 10)?.reveal).toBe(true);
  });
});

describe("planSoftRender 代码块选区", () => {
  it("整行选区带行尾换行时不淡显下一行闭合围栏", () => {
    const text = "```js\nconst a = 1;\n```";
    const bodyStart = text.indexOf("const");
    const closingFence = text.indexOf("\n", bodyStart) + 1;
    const active = planFor(text, bodyStart, closingFence);
    expect(active.hides.find((h) => h.from === closingFence)?.reveal).toBe(false);
  });

  it("代码块选区标记只覆盖代码正文，不包含围栏", () => {
    const text = "```js\nconst a = 1;\n```";
    const mark = findMark(planFor(text, 0, text.length), "cm-sr-code-selection");
    expect(mark).toBeDefined();
    expect(text.slice(mark?.from, mark?.to)).toBe("const a = 1;");
    expect(findMark(planFor(text, 0), "cm-sr-code-selection")).toBeUndefined();
  });
});

describe("planSoftRender 分割线与表格", () => {
  it("分割线在光标离开时渲染 widget，进入时淡显", () => {
    const text = "a\n\n---\n\nb";
    expect(planFor(text, 0).widgets.some((w) => w.kind === "hr")).toBe(true);
    expect(planFor(text, 4).hides.some((h) => h.reveal && h.from === 3)).toBe(true);
  });

  it("表格在光标离开时渲染 widget，进入时淡显", () => {
    const text = "before\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const widget = planFor(text, 0).widgets.find((w) => w.kind === "table");
    expect(widget).toBeDefined();
    expect(widget?.value).toContain("| a | b |");
    expect(planFor(text, 12).hides.some((h) => h.reveal && h.from === 8)).toBe(true);
  });

  it("选区命中表格时淡显源码", () => {
    const text = "| a |\n|---|\n| 1 |";
    const plan = planFor(text, 0, 3);
    expect(plan.hides.some((h) => h.reveal && h.from === 0)).toBe(true);
  });
});

describe("planSoftRender 有序列表编号", () => {
  it("列表 widget 一并替换标记后的分隔空格", () => {
    const bullet = planFor("-  item", 0).widgets.find((w) => w.kind === "bullet");
    const ordered = planFor("1.   item", 0).widgets.find((w) => w.kind === "number");
    expect(bullet).toMatchObject({ from: 0, to: 3 });
    expect(ordered).toMatchObject({ from: 0, to: 5 });
  });

  it("任务列表隐藏标记和分隔空格", () => {
    const plan = planFor("- [ ] todo", 0);
    expect(plan.hides).toContainEqual({ from: 0, to: 2, reveal: false });
  });

  it("读取起始编号并顺序递增", () => {
    const text = "5. a\n6. b";
    const numbers = planFor(text, 0).widgets.filter((w) => w.kind === "number").map((w) => w.index);
    expect(numbers).toEqual([5, 6]);
  });

  it("嵌套有序列表重新计数", () => {
    const text = "1. a\n   1. nested\n   2. nested\n2. b";
    const numbers = planFor(text, 0)
      .widgets.filter((w) => w.kind === "number")
      .sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
      .map((w) => w.index);
    expect(numbers).toEqual([1, 1, 2, 2]);
  });
});
