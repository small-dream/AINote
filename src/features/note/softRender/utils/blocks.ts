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

export { planFencedCode } from "./codeBlockPlan";

/** 引用块：隐藏 > 前缀；首行是 [!NOTE/TIP/...] 时按 Callout 渲染。 */
export function planBlockquote(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
): void {
  const active = isActiveRange(node.from, node.to, cursor, selectionTo);
  // > 前缀在首行是 Blockquote 的直接子节点，续行则会嵌进 Paragraph（甚至 Link 内部），
  // 必须遍历子树；但嵌套 Blockquote 的 > 由它自己的 planBlockquote 处理，这里跳过，
  // 否则同一范围会生成两条 reveal 不同的装饰。
  collectQuoteMarks(node, (mark) => {
    plan.hides.push({ from: mark.from, to: mark.to, reveal: active });
  });
  const callout = findCallout(node, doc);
  if (callout) {
    plan.blocks.push({ from: node.from, to: node.to, cls: `cm-sr-callout cm-sr-callout-${callout.kind}` });
    plan.hides.push({ from: callout.from, to: callout.to, reveal: active });
  } else {
    plan.blocks.push({ from: node.from, to: node.to, cls: "cm-sr-blockquote" });
  }
}

/** 收集当前引用块自己的 > 标记，不进入嵌套 Blockquote。 */
function collectQuoteMarks(node: SyntaxNode, add: (mark: SyntaxNode) => void): void {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "Blockquote") continue;
    if (child.name === "QuoteMark") add(child);
    else collectQuoteMarks(child, add);
  }
}

/** 无序/有序列表：隐藏/淡显 ListMark，否则渲染圆点或序号 widget。 */
export function planList(
  node: SyntaxNode,
  doc: string,
  plan: SoftRenderPlan,
  kind: "bullet" | "ordered",
): void {
  const items = collectListItems(node);
  if (items.length === 0) return;
  const firstMark = items[0]?.mark;
  const base = kind === "ordered" && firstMark ? parseOrderedMarker(doc.slice(firstMark.from, firstMark.to)) : null;
  const depth = listDepth(node);
  const format = depth === 0 ? "decimal" : depth === 1 ? "lower-roman" : "lower-alpha";
  const glyph = depth === 0 ? "•" : depth === 1 ? "◦" : "▪";
  items.forEach((item, index) =>
    emitListItem(item, doc, kind, plan, base, index, format, glyph, depth, index > 0),
  );
}

/** 嵌套层级：父级列表节点数量（0 = 顶层），用于复刻 GitHub 的 i / a 序号。 */
function listDepth(node: SyntaxNode): number {
  let depth = 0;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === "OrderedList" || parent.name === "BulletList") depth += 1;
  }
  return depth;
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
  doc: string,
  kind: "bullet" | "ordered",
  plan: SoftRenderPlan,
  base: number | null,
  index: number,
  format: "decimal" | "lower-roman" | "lower-alpha",
  glyph: string,
  depth: number,
  gapAbove: boolean,
): void {
  const { child, mark } = item;
  emitLineLayout(mark, doc, plan, depth, gapAbove);
  const ordinal = index + 1;
  const number = base !== null ? base + ordinal - 1 : ordinal;
  if (child.getChild("Task")) {
    plan.hides.push({ from: mark.from, to: listMarkEnd(mark, doc), reveal: false });
  } else {
    plan.widgets.push(toListWidget(kind, mark, listMarkEnd(mark, doc), number, format, glyph));
  }
}

/**
 * 列表行的版式：按嵌套层级套缩进类（每级 2em，与预览一致），隐藏源码里的缩进空格，
 * 并把「同层相邻项之间 4px」的间距类打在行上（预览的 li + li）。
 */
function emitLineLayout(mark: SyntaxNode, doc: string, plan: SoftRenderPlan, depth: number, gapAbove: boolean): void {
  const lineStart = doc.lastIndexOf("\n", mark.from - 1) + 1;
  plan.gaps.push({ pos: lineStart, cls: `cm-sr-list-depth-${Math.min(depth, 4)}` });
  if (gapAbove) plan.gaps.push({ pos: lineStart, cls: "cm-sr-list-gap" });
  let indentFrom = mark.from;
  while (indentFrom > lineStart && (doc[indentFrom - 1] === " " || doc[indentFrom - 1] === "\t")) indentFrom -= 1;
  if (indentFrom < mark.from) plan.hides.push({ from: indentFrom, to: mark.from, reveal: false });
}

/** ListMark 不包含标记后的分隔空格；软渲染时一并替换，避免源码空格叠加 widget 宽度。 */
function listMarkEnd(mark: SyntaxNode, doc: string): number {
  let end = mark.to;
  while (doc[end] === " " || doc[end] === "\t") end += 1;
  return end;
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

function toListWidget(
  kind: "bullet" | "ordered",
  mark: SyntaxNode,
  to: number,
  index: number,
  format: "decimal" | "lower-roman" | "lower-alpha",
  glyph: string,
): WidgetRange {
  return kind === "ordered"
    ? { kind: "number", from: mark.from, to, index, listFormat: format }
    : { kind: "bullet", from: mark.from, to, glyph };
}

export type { BlockRange, HideRange };
