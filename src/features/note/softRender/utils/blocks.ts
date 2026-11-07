import type { SyntaxNode } from "@lezer/common";
import type { BlockRange, HideRange, SoftRenderPlan, TextRange, WidgetRange } from "../types";
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

/**
 * 围栏代码块：光标离开时渲染为高亮/Mermaid widget；进入时就地编辑源码。
 * 编辑态默认隐藏 ```（围栏行不显示字符，行高即代码块的上下内边距）；
 * 只有光标落到围栏行本身时才淡显，用于改语言或改围栏。
 */
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
    planActiveCodeBlock(node, doc, plan, marks, cursor, selectionTo);
  } else {
    planInactiveCodeBlock(node, doc, plan);
  }
}

function planActiveCodeBlock(
  node: SyntaxNode,
  doc: string,
  plan: SoftRenderPlan,
  marks: SyntaxNode[],
  cursor: number,
  selectionTo?: number,
): void {
  const lines = collectCodeLines(node, doc);
  const openLine = lineIndexAt(lines, marks[0]?.from ?? node.from);
  const closeLine = lineIndexAt(lines, marks[marks.length - 1]?.from ?? node.to);
  const revealed = new Set<number>();
  if (openLine >= 0 && lineHit(lines[openLine], cursor, selectionTo)) revealed.add(openLine);
  if (closeLine >= 0 && lineHit(lines[closeLine], cursor, selectionTo)) revealed.add(closeLine);

  for (const mark of marks) {
    const index = lineIndexAt(lines, mark.from);
    plan.hides.push({ from: mark.from, to: mark.to, reveal: revealed.has(index) });
  }
  const info = node.getChild("CodeInfo");
  if (info) plan.hides.push({ from: info.from, to: info.to, reveal: revealed.has(lineIndexAt(lines, info.from)) });
  planCodeBlockLines(lines, plan);
  const text = node.getChild("CodeText");
  if (text) plan.marks.push({ from: text.from, to: text.to, cls: "cm-sr-code-text" });
}

/** 代码块占据的源码行（首行是开围栏，末行是闭围栏，末行可能不含换行）。 */
function collectCodeLines(node: SyntaxNode, doc: string): TextRange[] {
  const lines: TextRange[] = [];
  let lineStart = node.from;
  for (;;) {
    const newline = doc.indexOf("\n", lineStart);
    const lineEnd = newline === -1 || newline >= node.to ? node.to : newline;
    lines.push({ from: lineStart, to: lineEnd });
    if (newline === -1 || newline >= node.to) return lines;
    lineStart = newline + 1;
  }
}

function lineIndexAt(lines: TextRange[], pos: number): number {
  return lines.findIndex((line) => pos >= line.from && pos <= line.to);
}

/** 光标/选区是否落在这一行上（用于只淡显光标所在的那条围栏）。 */
function lineHit(line: TextRange | undefined, cursor: number, selectionTo?: number): boolean {
  if (!line) return false;
  if (selectionTo === undefined) return cursor >= line.from && cursor <= line.to;
  const start = Math.min(cursor, selectionTo);
  const end = Math.max(cursor, selectionTo);
  return start <= line.to && end >= line.from;
}

function planCodeBlockLines(lines: TextRange[], plan: SoftRenderPlan): void {
  lines.forEach((line, index) => {
    plan.gaps.push({ pos: line.from, cls: codeBlockLineClass(index === 0, index === lines.length - 1) });
  });
}

function codeBlockLineClass(isFirst: boolean, isLast: boolean): string {
  const classes = ["cm-sr-codeblock-line"];
  if (isFirst) classes.push("cm-sr-codeblock-line-first");
  if (isLast) classes.push("cm-sr-codeblock-line-last");
  return classes.join(" ");
}

function planInactiveCodeBlock(node: SyntaxNode, doc: string, plan: SoftRenderPlan): void {
  const { code, language } = describeCodeBlock(node, doc);
  if (language.toLocaleLowerCase() === "mermaid") {
    plan.widgets.push({ kind: "mermaid", from: node.from, to: node.to, value: code });
  } else {
    // 点击 widget 时直接落到正文首行，不把光标放进围栏（否则围栏会被淡显出来）。
    plan.widgets.push({
      kind: "codeblock",
      from: node.from,
      to: node.to,
      value: code,
      alt: language,
      caret: firstCodeLineStart(node, doc),
    });
  }
}

function firstCodeLineStart(node: SyntaxNode, doc: string): number {
  const newline = doc.indexOf("\n", node.from);
  return newline === -1 || newline >= node.to ? node.from + 1 : newline + 1;
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
  plan: SoftRenderPlan,
  kind: "bullet" | "ordered",
): void {
  const items = collectListItems(node);
  if (items.length === 0) return;
  const firstMark = items[0]?.mark;
  const base = kind === "ordered" && firstMark ? parseOrderedMarker(doc.slice(firstMark.from, firstMark.to)) : null;
  items.forEach((item, index) => emitListItem(item, doc, kind, plan, base, index));
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
): void {
  const { child, mark } = item;
  const ordinal = index + 1;
  const number = base !== null ? base + ordinal - 1 : ordinal;
  if (child.getChild("Task")) {
    plan.hides.push({ from: mark.from, to: listMarkEnd(mark, doc), reveal: false });
  } else {
    plan.widgets.push(toListWidget(kind, mark, listMarkEnd(mark, doc), number));
  }
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

function toListWidget(kind: "bullet" | "ordered", mark: SyntaxNode, to: number, index: number): WidgetRange {
  return kind === "ordered"
    ? { kind: "number", from: mark.from, to, index }
    : { kind: "bullet", from: mark.from, to };
}

export type { BlockRange, HideRange };
