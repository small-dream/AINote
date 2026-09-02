import type { SyntaxNode } from "@lezer/common";
import type { SoftRenderPlan } from "../types";
import { isActiveRange } from "./ranges";

export type InlineHandler = (
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
) => void;

/** 成对标记的行内元素（加粗/斜体/删除线）：始终隐藏标记，正文套样式，编辑时保持渲染效果。 */
export function planMarkedPair(node: SyntaxNode, markName: string, cls: string, plan: SoftRenderPlan): void {
  const marks = node.getChildren(markName);
  if (marks.length < 2) return;
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) return;
  for (const mark of marks) plan.hides.push({ from: mark.from, to: mark.to, reveal: false });
  if (first.to < last.from) plan.marks.push({ from: first.to, to: last.from, cls });
}

/** 行内代码：始终隐藏反引号，内容按代码片渲染，编辑时保持渲染效果。 */
export function planInlineCode(node: SyntaxNode, _doc: string, _cursor: number, plan: SoftRenderPlan): void {
  const marks = node.getChildren("CodeMark");
  if (marks.length < 2) return;
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) return;
  for (const mark of marks) plan.hides.push({ from: mark.from, to: mark.to, reveal: false });
  plan.marks.push({ from: first.to, to: last.from, cls: "cm-sr-inline-code" });
}

/** 图片：光标离开时渲染为图片 widget；进入时淡显原始语法以便编辑。 */
export function planImage(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const url = node.getChild("URL");
  const marks = node.getChildren("LinkMark");
  const first = marks[0];
  const second = marks[1];
  const alt = first && second ? doc.slice(first.to, second.from) : "";
  const active = isActiveRange(node.from, node.to, cursor, selectionTo);
  if (active) {
    for (const mark of marks) plan.hides.push({ from: mark.from, to: mark.to, reveal: true });
    if (url) plan.hides.push({ from: url.from, to: url.to, reveal: true });
    return;
  }
  plan.widgets.push({
    kind: "image",
    from: node.from,
    to: node.to,
    value: url ? doc.slice(url.from, url.to) : "",
    alt,
  });
}

/** 任务标记 [x]/[ ]：替换为可交互勾选框 widget。 */
export function planTaskMarker(node: SyntaxNode, doc: string, _cursor: number, plan: SoftRenderPlan): void {
  const text = doc.slice(node.from, node.to);
  plan.widgets.push({
    kind: "checkbox",
    from: node.from,
    to: node.to,
    checked: /^\[[xX]\]/.test(text),
  });
}

/** 普通链接：隐藏 [](url)，正文按链接样式；Cmd/Ctrl+点击打开。 */
export function planLink(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const url = node.getChild("URL");
  const marks = node.getChildren("LinkMark");
  const first = marks[0];
  const second = marks[1];
  if (!url || !first || !second) return;
  const textFrom = first.to;
  const textTo = second.from;
  const active = isActiveRange(node.from, node.to, cursor, selectionTo);
  for (const mark of marks) plan.hides.push({ from: mark.from, to: mark.to, reveal: active });
  plan.hides.push({ from: url.from, to: url.to, reveal: active });
  if (textFrom < textTo) {
    plan.marks.push({
      from: textFrom,
      to: textTo,
      cls: "cm-sr-link",
      attrs: { "data-sr-href": doc.slice(url.from, url.to) },
    });
  }
}
