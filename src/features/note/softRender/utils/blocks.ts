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
    planCalloutBlocks(node, doc, plan, callout.kind);
    plan.hides.push({ from: callout.from, to: callout.to, reveal: active });
  } else {
    plan.blocks.push({ from: node.from, to: node.to, cls: "cm-sr-blockquote" });
  }
}

/** Callout 的块装饰按行展开成每行一个 span：标题类只打在首行（否则 ::before 标题随行重复），
    末行类打在最后一行（垂直呼吸位由 CSS 落到对应行盒上）。 */
function planCalloutBlocks(node: SyntaxNode, doc: string, plan: SoftRenderPlan, kind: string): void {
  const base = `cm-sr-callout cm-sr-callout-${kind}`;
  const firstLineEnd = doc.indexOf("\n", node.from);
  const lastLineStart = doc.lastIndexOf("\n", node.to - 1) + 1;
  if (firstLineEnd === -1 || firstLineEnd >= node.to) {
    plan.blocks.push({ from: node.from, to: node.to, cls: `${base} cm-sr-callout-title cm-sr-callout-last` });
    return;
  }
  plan.blocks.push({ from: node.from, to: firstLineEnd, cls: `${base} cm-sr-callout-title` });
  if (lastLineStart > firstLineEnd + 1) {
    plan.blocks.push({ from: firstLineEnd + 1, to: lastLineStart, cls: base });
  }
  plan.blocks.push({ from: lastLineStart, to: node.to, cls: `${base} cm-sr-callout-last` });
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
  emitLineLayout(item, doc, plan, depth, gapAbove);
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
 * 跨源码行的列表项（缩进续行 / 懒续行）同样打缩进类并隐藏行首空白，续行落在内容列
 * 而不是退回最左列；嵌套列表覆盖的行交给内层 planList 处理，避免装饰重复叠加；
 * 行首空白若已处于行内代码等替换范围内则保留可见。
 */
function emitLineLayout(item: ListItemInfo, doc: string, plan: SoftRenderPlan, depth: number, gapAbove: boolean): void {
  const { child, mark } = item;
  const depthCls = `cm-sr-list-depth-${Math.min(depth, 4)}`;
  const markLine = doc.lastIndexOf("\n", mark.from - 1) + 1;
  plan.gaps.push({ pos: markLine, cls: depthCls });
  if (gapAbove) plan.gaps.push({ pos: markLine, cls: "cm-sr-list-gap" });
  let indentFrom = mark.from;
  while (indentFrom > markLine && isIndentChar(doc[indentFrom - 1])) indentFrom -= 1;
  if (indentFrom < mark.from) plan.hides.push({ from: indentFrom, to: mark.from, reveal: false });
  // 嵌套列表的行首空白属于内层项的缩进，范围扩张到行首，外层才能整行跳过。
  const nestedLists = collectRanges(child, (name) => name === "BulletList" || name === "OrderedList")
    .map((range) => ({ from: doc.lastIndexOf("\n", range.from - 1) + 1, to: range.to }));
  const protectedSpans = collectRanges(child, (name) => name === "InlineCode" || name === "FencedCode" || name === "CodeBlock");
  let lineStart = doc.indexOf("\n", markLine) + 1;
  while (lineStart > markLine && lineStart < child.to) {
    if (!inRanges(lineStart, nestedLists)) {
      plan.gaps.push({ pos: lineStart, cls: depthCls });
      hideLineIndent(lineStart, child.to, doc, plan, protectedSpans);
    }
    const nextBreak = doc.indexOf("\n", lineStart);
    if (nextBreak === -1) break;
    lineStart = nextBreak + 1;
  }
}

/** 子树内按节点名收集范围：嵌套列表行跳过（内层 planList 负责），行内代码等替换范围不隐藏。 */
function collectRanges(node: SyntaxNode, matches: (name: string) => boolean): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const visit = (current: SyntaxNode): void => {
    for (let child = current.firstChild; child; child = child.nextSibling) {
      if (matches(child.name)) ranges.push({ from: child.from, to: child.to });
      visit(child);
    }
  };
  visit(node);
  return ranges;
}

function inRanges(pos: number, ranges: ReadonlyArray<{ from: number; to: number }>): boolean {
  return ranges.some((range) => pos >= range.from && pos < range.to);
}

/** 续行行首空白：软渲染里缩进由行的 padding 类承担，源码空白隐藏；
    与行内代码等替换范围相交时裁剪或跳过，避免装饰重叠。 */
function hideLineIndent(
  lineStart: number,
  itemEnd: number,
  doc: string,
  plan: SoftRenderPlan,
  protectedSpans: ReadonlyArray<{ from: number; to: number }>,
): void {
  let wsEnd = lineStart;
  while (wsEnd < itemEnd && isIndentChar(doc[wsEnd])) wsEnd += 1;
  if (wsEnd === lineStart) return;
  const span = protectedSpans.find((range) => range.from < wsEnd && range.to > lineStart);
  if (span) {
    if (span.from <= lineStart) return;
    wsEnd = span.from;
  }
  plan.hides.push({ from: lineStart, to: wsEnd, reveal: false });
}

function isIndentChar(char: string | undefined): boolean {
  return char === " " || char === "\t";
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
