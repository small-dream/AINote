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

function findWidget(plan: SoftRenderPlan, kind: string) {
  return plan.widgets.find((w) => w.kind === kind);
}

describe("planSoftRender 行内强调", () => {
  it("加粗/斜体/删除线隐藏标记并标记内容", () => {
    const text = "a **bold** and *em* and ~~strike~~";
    const plan = planFor(text, 0);
    const b = text.indexOf("**bold**");
    expect(findMark(plan, "cm-sr-strong")).toMatchObject({ from: b + 2, to: b + 6 });
    expect(plan.hides.find((h) => h.from === b)?.reveal).toBe(false);
    const e = text.indexOf("*em*");
    expect(findMark(plan, "cm-sr-em")).toMatchObject({ from: e + 1, to: e + 3 });
    const s = text.indexOf("~~strike~~");
    expect(findMark(plan, "cm-sr-strike")).toMatchObject({ from: s + 2, to: s + 8 });
  });

  it("光标进入强调元素时标记仍隐藏，保持渲染效果", () => {
    const text = "**bold**";
    const hides = planFor(text, 3).hides.filter((h) => h.from === 0 || h.from === 6);
    expect(hides).toHaveLength(2);
    expect(hides.every((h) => h.reveal === false)).toBe(true);
    expect(hides.every((h) => h.zeroWidth === true)).toBe(true);
  });

  it("选区命中强调元素时标记仍隐藏，保持渲染效果", () => {
    const text = "**bold**";
    const hides = planFor(text, 0, 6).hides.filter((h) => h.from === 0 || h.from === 6);
    expect(hides).toHaveLength(2);
    expect(hides.every((h) => h.reveal === false)).toBe(true);
    expect(hides.every((h) => h.zeroWidth === true)).toBe(true);
  });

  it("行内代码隐藏反引号", () => {
    const text = "a `code` b";
    const plan = planFor(text, 1);
    expect(findMark(plan, "cm-sr-inline-code")).toMatchObject({
      from: text.indexOf("`") + 1,
      to: text.lastIndexOf("`"),
    });
    expect(plan.hides.find((h) => h.from === text.indexOf("`"))?.reveal).toBe(false);
    expect(plan.hides.find((h) => h.from === text.indexOf("`"))?.zeroWidth).toBe(true);
  });
});

describe("planSoftRender 列表", () => {
  it("无序列表始终渲染圆点，光标所在项也隐藏标记", () => {
    const text = "- a\n- b";
    const plan = planFor(text, text.length - 1);
    expect(plan.widgets.filter((w) => w.kind === "bullet")).toHaveLength(2);
    expect(plan.widgets.some((w) => w.from === 4)).toBe(true);
    expect(plan.hides.some((h) => h.reveal && h.from === 4)).toBe(false);
  });

  it("有序列表按序号渲染", () => {
    const text = "before\n\n1. a\n2. b";
    const numbers = planFor(text, 0).widgets.filter((w) => w.kind === "number").map((w) => w.index);
    expect(numbers).toEqual([1, 2]);
  });

  it("任务列表渲染勾选框 widget", () => {
    const text = "- [x] done\n- [ ] todo";
    const boxes = planFor(text, text.length - 1).widgets.filter((w) => w.kind === "checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ checked: true });
    expect(boxes[1]).toMatchObject({ checked: false });
  });
});

describe("planSoftRender 块级间距（空行折叠）", () => {
  it("把源码中分隔块的每个空行登记为空白间距", () => {
    const text = "# 标题\n\n第一段\n\n第二段";
    const plan = planFor(text, 0);
    expect(plan.gaps.map((g) => ({ pos: g.pos, cls: g.cls }))).toEqual(
      blankLinePositions(text).map((pos) => ({ pos, cls: "cm-sr-blank" })),
    );
  });

  it("跳过围栏代码块内部的空行", () => {
    const text = "前\n\n```\n\n  \n```\n\n后";
    const plan = planFor(text, 0);
    const positions = plan.gaps.map((g) => g.pos);
    expect(positions).toEqual(blankLinePositions(text).filter((pos) => !insideFence(text, pos)));
    expect(positions).toContain(text.indexOf("\n\n后") + 1);
  });

  it("标题前的空行使用标题间距类，其余用正文间距类", () => {
    const text = "第一段\n\n## 标题\n\n第二段";
    const plan = planFor(text, 0);
    expect(plan.gaps.find((g) => g.pos === text.indexOf("\n\n## 标题") + 1)?.cls).toBe("cm-sr-blank-heading");
    expect(plan.gaps.find((g) => g.pos === text.indexOf("\n\n第二段") + 1)?.cls).toBe("cm-sr-blank");
  });
});

/** 收集文本中每个空白行（trim 后为空）的起始偏移。 */
function blankLinePositions(text: string): number[] {
  const out: number[] = [];
  let start = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") out.push(start);
    start += line.length + 1;
  }
  return out;
}

/** 粗略判断一个偏移是否落在 ``` 围栏代码块内部（仅供空行折叠测试用）。 */
function insideFence(text: string, pos: number): boolean {
  const before = text.slice(0, pos);
  const fences = before.match(/```/g)?.length ?? 0;
  return fences % 2 === 1;
}

describe("planSoftRender 链接与图片", () => {
  it("普通链接隐藏语法并登记可点击", () => {
    const text = "before [text](https://ex.com)";
    const plan = planFor(text, 0);
    const start = text.indexOf("[");
    expect(findMark(plan, "cm-sr-link")).toMatchObject({
      from: start + 1,
      to: start + 5,
      attrs: { "data-sr-href": "https://ex.com" },
    });
    expect(plan.hides.find((h) => h.from === start)?.reveal).toBe(false);
    const active = planFor(text, start + 2);
    expect(active.hides.find((h) => h.from === start)?.reveal).toBe(true);
  });

  it("双链识别 target/alias", () => {
    const text = "[[目标|别名]]";
    const plan = planFor(text, 0);
    expect(findMark(plan, "cm-sr-wikilink")).toMatchObject({
      from: 5,
      to: 7,
      attrs: { "data-sr-target": "目标" },
    });
    expect(plan.hides.some((h) => h.from === 0 && h.to === 2)).toBe(true);
    expect(plan.hides.some((h) => h.from === 2 && h.to === 5)).toBe(true);
    expect(plan.hides.some((h) => h.from === 7 && h.to === 9)).toBe(true);
  });

  it("双链无别名时以目标为标签", () => {
    const text = "[[目标]]";
    expect(findMark(planFor(text, 0), "cm-sr-wikilink")).toMatchObject({ from: 2, to: 4 });
  });

  it("图片替换为 image widget", () => {
    const text = "![alt](assets/a.png)";
    expect(findWidget(planFor(text, 0), "image")).toMatchObject({
      value: "assets/a.png",
      alt: "alt",
      from: 0,
      to: text.length,
    });
  });
});

describe("planSoftRender 双链过滤", () => {
  it("跳过行内代码与围栏代码块中的双链", () => {
    const text = "`[[not link]]`\n\n```\n[[not link]]\n```\n\n[[real link]]";
    const wikis = planFor(text, 0).marks.filter((m) => m.cls === "cm-sr-wikilink");
    expect(wikis).toHaveLength(1);
    expect(wikis[0]).toMatchObject({ attrs: { "data-sr-target": "real link" } });
  });
});

describe("planSoftRender 数学公式", () => {
  it("识别行内 $...$ 与块级 $$...$$", () => {
    const text = "x = $a + b$\n\n$$y = c$$";
    const math = planFor(text, 0).widgets.filter((w) => w.kind === "math");
    expect(math).toHaveLength(2);
    expect(math[0]).toMatchObject({ mode: "inline", value: "a + b" });
    expect(math[1]).toMatchObject({ mode: "block", value: "y = c" });
  });

  it("光标进入数学公式时显示源码", () => {
    const plan = planFor("$x$", 1);
    expect(findWidget(plan, "math")).toBeUndefined();
    expect(plan.mathRanges).toHaveLength(1);
  });
});

describe("planSoftRender 自动链接", () => {
  it("识别裸链 URL", () => {
    const text = "see https://example.com here";
    const link = findMark(planFor(text, 0), "cm-sr-autolink");
    expect(link).toMatchObject({
      from: 4,
      to: 23,
      attrs: { "data-sr-href": "https://example.com" },
    });
  });

  it("跳过代码、链接与数学公式中的 URL", () => {
    const text = "`https://in.code.com` [a](https://in.link.com) $https://in.math.com$ https://ok.com";
    const links = planFor(text, 0).marks.filter((m) => m.cls === "cm-sr-autolink");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ attrs: { "data-sr-href": "https://ok.com" } });
  });
});
