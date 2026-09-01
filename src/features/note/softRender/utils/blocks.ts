import type { SyntaxNode } from "@lezer/common";
import type { BlockRange, HideRange, SoftRenderPlan, WidgetRange } from "../types";
import { isActiveRange } from "./ranges";

export type BlockHandler = (
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
) => void;

/** ATX 标题：隐藏 # 前缀，正文按级别放大；光标/选区进入时淡显标记。 */
export function planHeading(
  node: SyntaxNode,
  _doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const mark = node.getChild("HeaderMark");
  if (!mark) return;
  plan.hides.push({ from: mark.from, to: mark.to, reveal: isActiveRange(node.from, node.to, cursor, selectionTo) });
  plan.marks.push({ from: mark.to, to: node.to, cls: headingClass(node) });
}

/** Setext 标题（=== / --- 下划线式）：隐藏下划线，正文按级别放大。 */
export function planSetextHeading(
  node: SyntaxNode,
  _doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const mark = node.getChild("HeaderMark");
  if (!mark) return;
  plan.hides.push({ from: mark.from, to: mark.to, reveal: isActiveRange(node.from, node.to, cursor, selectionTo) });
  plan.marks.push({ from: node.from, to: mark.from, cls: headingClass(node) });
}

function headingClass(node: SyntaxNode): string {
  const prefix = node.name.startsWith("Setext") ? "SetextHeading" : "ATXHeading";
  return `cm-sr-h${node.name.slice(prefix.length)}`;
}

/** 围栏代码块：光标离开时渲染为高亮/Mermaid widget；进入时淡显围栏并编辑源码。 */
export function planFencedCode(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const marks = node.getChildren("CodeMark");
  if (marks.length < 2) return;
  if (isActiveRange(node.from, node.to, cursor, selectionTo)) {
    planActiveCodeBlock(node, plan, marks);
  } else {
    planInactiveCodeBlock(node, doc, plan);
  }
}

function planActiveCodeBlock(node: SyntaxNode, plan: SoftRenderPlan, marks: SyntaxNode[]): void {
  for (const mark of marks) plan.hides.push({ from: mark.from, to: mark.to, reveal: true });
  const info = node.getChild("CodeInfo");
  if (info) plan.hides.push({ from: info.from, to: info.to, reveal: true });
  plan.blocks.push({ from: node.from, to: node.to, cls: "cm-sr-codeblock" });
  const text = node.getChild("CodeText");
  if (text) plan.marks.push({ from: text.from, to: text.to, cls: "cm-sr-code-text" });
}

function planInactiveCodeBlock(node: SyntaxNode, doc: string, plan: SoftRenderPlan): void {
  const { code, language } = describeCodeBlock(node, doc);
  if (language.toLocaleLowerCase() === "mermaid") {
    plan.widgets.push({ kind: "mermaid", from: node.from, to: node.to, value: code });
  } else {
    plan.widgets.push({ kind: "codeblock", from: node.from, to: node.to, value: code, alt: language });
  }
}

function describeCodeBlock(node: SyntaxNode, doc: string): { code: string; language: string } {
  const info = node.getChild("CodeInfo");
  const text = node.getChild("CodeText");
  return {
    code: text ? doc.slice(text.from, text.to) : "",
    language: info ? doc.slice(info.from, info.to).trim() : "",
  };
}

/** 引用块：隐藏 > 前缀；首行是 [!NOTE/TIP/...] 时按 Callout 渲染。 */
export function planBlockquote(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const active = isActiveRange(node.from, node.to, cursor, selectionTo);
  for (const mark of node.getChildren("QuoteMark")) plan.hides.push({ from: mark.from, to: mark.to, reveal: active });
  const callout = findCallout(node, doc);
  if (callout) {
    plan.blocks.push({ from: node.from, to: node.to, cls: `cm-sr-callout cm-sr-callout-${callout.kind}` });
    plan.hides.push({ from: callout.from, to: callout.to, reveal: active });
  } else {
    plan.blocks.push({ from: node.from, to: node.to, cls: "cm-sr-blockquote" });
  }
}

/** 无序/有序列表：隐藏/淡显 ListMark，否则渲染圆点或序号 widget。 */
export function planList(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  kind: "bullet" | "ordered",
  selectionTo?: number,
): void {
  const items = collectListItems(node);
  if (items.length === 0) return;
  const firstMark = items[0]?.mark;
  const base = kind === "ordered" && firstMark ? parseOrderedMarker(doc.slice(firstMark.from, firstMark.to)) : null;
  items.forEach((item, index) => emitListItem(item, kind, cursor, plan, selectionTo, base, index));
}

interface ListItemInfo {
  child: SyntaxNode;
  mark: SyntaxNode;
}

function collectListItems(node: SyntaxNode): ListItemInfo[] {
  const items: ListItemInfo[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== "ListItem") continue;
    const mark = child.firstChild;
    if (!mark || mark.name !== "ListMark") continue;
    items.push({ child, mark });
  }
  return items;
}

function emitListItem(
  item: ListItemInfo,
  kind: "bullet" | "ordered",
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo: number | undefined,
  base: number | null,
  index: number,
): void {
  const { child, mark } = item;
  const ordinal = index + 1;
  const number = base !== null ? base + ordinal - 1 : ordinal;
  const inItem = isActiveRange(child.from, child.to, cursor, selectionTo);
  if (child.getChild("Task")) {
    plan.hides.push({ from: mark.from, to: mark.to, reveal: false });
  } else if (inItem) {
    plan.hides.push({ from: mark.from, to: mark.to, reveal: true });
  } else {
    plan.widgets.push(toListWidget(kind, mark, number));
  }
}

function parseOrderedMarker(text: string): number {
  const match = /^\s*(\d+)[.)]/.exec(text);
  return match ? Number(match[1]) : 1;
}

/** 分割线：光标不在其上时渲染为分隔线 widget。 */
export function planHr(
  node: SyntaxNode,
  _doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  if (isActiveRange(node.from, node.to, cursor, selectionTo)) {
    plan.hides.push({ from: node.from, to: node.to, reveal: true });
  } else {
    plan.widgets.push({ kind: "hr", from: node.from, to: node.to });
  }
}

/** 表格：光标不在其内时渲染为表格 widget，进入则淡显源码。 */
export function planTable(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  if (isActiveRange(node.from, node.to, cursor, selectionTo)) {
    plan.hides.push({ from: node.from, to: node.to, reveal: true });
  } else {
    plan.widgets.push({ kind: "table", from: node.from, to: node.to, value: doc.slice(node.from, node.to) });
  }
}

const CALLOUT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]\s*/i;

function findCallout(node: SyntaxNode, doc: string): { from: number; to: number; kind: string } | null {
  const para = node.getChild("Paragraph");
  if (!para) return null;
  const match = CALLOUT_RE.exec(doc.slice(para.from, para.to));
  if (!match) return null;
  return { from: para.from, to: para.from + match[0].length, kind: match[1]?.toLocaleLowerCase() ?? "" };
}

function toListWidget(kind: "bullet" | "ordered", mark: SyntaxNode, index: number): WidgetRange {
  return kind === "ordered"
    ? { kind: "number", from: mark.from, to: mark.to, index }
    : { kind: "bullet", from: mark.from, to: mark.to };
}

export type { BlockRange, HideRange };
