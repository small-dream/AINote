import { parser, GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./plan";
import type { SoftRenderPlan } from "../types";

const md = parser.configure([GFM]);

function planFor(text: string, cursor = 0): SoftRenderPlan {
  return planSoftRender(md.parse(text), text, cursor);
}

function footnoteWidgets(plan: SoftRenderPlan, kind: "footnote-ref" | "footnote-def") {
  return plan.widgets.filter((widget) => widget.kind === kind);
}

describe("planSoftRender 脚注", () => {
  it("引用按首次引用顺序编号，定义显示同一序号", () => {
    const text = "甲[^a] 乙[^b]\n\n[^a]: A\n[^b]: B\n";
    const plan = planFor(text);
    expect(footnoteWidgets(plan, "footnote-ref").map((widget) => widget.value)).toEqual(["1", "2"]);
    expect(footnoteWidgets(plan, "footnote-def").map((widget) => widget.value)).toEqual(["1", "2"]);
    expect(plan.blocks.filter((block) => block.cls === "cm-sr-footnote-def")).toHaveLength(2);
  });

  it("命名标签同样按引用顺序重编号", () => {
    const text = "正文[^note]\n\n[^note]: 脚注内容\n";
    const plan = planFor(text);
    expect(footnoteWidgets(plan, "footnote-ref")[0]).toMatchObject({ from: 2, to: 9, value: "1" });
    expect(footnoteWidgets(plan, "footnote-def")[0]).toMatchObject({ from: 11, to: 20, value: "1" });
  });

  it("标签大小写不敏感", () => {
    const text = "a[^A]\n\n[^a]: note\n";
    expect(footnoteWidgets(planFor(text), "footnote-ref")).toHaveLength(1);
  });

  it("没有定义的引用保持源码，不渲染为脚注", () => {
    expect(footnoteWidgets(planFor("正文[^x]"), "footnote-ref")).toHaveLength(0);
  });

  it("没有引用的定义保持源码", () => {
    const plan = planFor("[^x]: 内容\n");
    expect(plan.widgets).toHaveLength(0);
    expect(plan.blocks).toHaveLength(0);
  });

});

describe("planSoftRender 脚注边界", () => {
  it("光标进入引用或定义标记时不替换，保留源码用于编辑", () => {
    const text = "正文[^1]\n\n[^1]: note\n";
    expect(footnoteWidgets(planFor(text, 4), "footnote-ref")).toHaveLength(0);
    const inDefinition = planFor(text, 11);
    expect(footnoteWidgets(inDefinition, "footnote-def")).toHaveLength(0);
    expect(inDefinition.blocks.filter((block) => block.cls === "cm-sr-footnote-def")).toHaveLength(1);
  });

  it("2 空格缩进的定义是新定义，不并入上一条", () => {
    const text = "[^a]: A\n  [^b]: B\n\nx[^a] y[^b]\n";
    const plan = planFor(text);
    expect(footnoteWidgets(plan, "footnote-def")).toHaveLength(2);
    expect(footnoteWidgets(plan, "footnote-ref").map((widget) => widget.value)).toEqual(["1", "2"]);
  });

  it("定义正文的行内格式仍然渲染", () => {
    const text = "见[^1]\n\n[^1]: 内容 **加粗**";
    const plan = planFor(text);
    expect(plan.marks.find((mark) => mark.cls === "cm-sr-strong")).toMatchObject({ from: 18, to: 20 });
  });

  it("多行定义把 4 空格缩进续行一起归入脚注块", () => {
    const text = "[^n]: 第一行\n    第二行\n\n正文[^n]";
    const plan = planFor(text);
    const block = plan.blocks.find((b) => b.cls === "cm-sr-footnote-def");
    expect(block?.from).toBe(0);
    expect(block?.to).toBe(text.indexOf("\n\n正文"));
    expect(footnoteWidgets(plan, "footnote-ref")).toHaveLength(1);
  });

  it("[^1](url) 与 remark-gfm 一致按脚注处理，不再套链接样式", () => {
    const text = "正文[^1](url)\n\n[^1]: note\n";
    const plan = planFor(text);
    expect(footnoteWidgets(plan, "footnote-ref")).toHaveLength(1);
    expect(plan.marks.some((mark) => mark.cls === "cm-sr-link")).toBe(false);
  });

  it("引用后跟空格和括号仍按脚注处理", () => {
    const text = "正文[^1] (补充)\n\n[^1]: note\n";
    expect(footnoteWidgets(planFor(text), "footnote-ref")).toHaveLength(1);
  });

  it("代码块（含缩进代码块）里的 [^] 不误判为脚注", () => {
    expect(footnoteWidgets(planFor("```\n[^1]\n```\n\n[^1]: note\n"), "footnote-ref")).toHaveLength(0);
    expect(footnoteWidgets(planFor("    [^1] code\n\n[^1]: note\n"), "footnote-ref")).toHaveLength(0);
  });
});
