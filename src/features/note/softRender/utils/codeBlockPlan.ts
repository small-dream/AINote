import type { SyntaxNode } from "@lezer/common";
import type { SoftRenderPlan, TextRange, WidgetRange } from "../types";
import { isActiveRange } from "./ranges";

/** 围栏代码块：光标离开时渲染为高亮/Mermaid widget；进入时就地编辑源码。 */
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
  const revealed = revealedFenceLines(lines, marks, cursor, selectionTo);
  hideFenceMarks(marks, lines, revealed, plan);
  hideCodeInfo(node, lines, revealed, plan);
  planCodeBlockLines(lines, plan);
  markCodeText(node, plan);
  markCodeSelection(node, cursor, selectionTo, plan);
  pushEditWidgets(node, doc, lines, marks, plan);
}

function revealedFenceLines(
  lines: TextRange[],
  marks: SyntaxNode[],
  cursor: number,
  selectionTo?: number,
): Set<number> {
  const revealed = new Set<number>();
  // 选择文本不代表要编辑围栏；拖选或全选经过围栏时也应保持卡片外观。
  if (selectionTo !== undefined && selectionTo !== cursor) return revealed;
  for (const position of [marks[0]?.from, marks[marks.length - 1]?.from]) {
    const index = position === undefined ? -1 : lineIndexAt(lines, position);
    if (index >= 0 && lineHit(lines[index], cursor)) revealed.add(index);
  }
  return revealed;
}

function hideFenceMarks(marks: SyntaxNode[], lines: TextRange[], revealed: Set<number>, plan: SoftRenderPlan): void {
  for (const mark of marks) {
    const index = lineIndexAt(lines, mark.from);
    plan.hides.push({ from: mark.from, to: mark.to, reveal: revealed.has(index) });
  }
}

function hideCodeInfo(node: SyntaxNode, lines: TextRange[], revealed: Set<number>, plan: SoftRenderPlan): void {
  const info = node.getChild("CodeInfo");
  if (info) plan.hides.push({ from: info.from, to: info.to, reveal: revealed.has(lineIndexAt(lines, info.from)) });
}

function markCodeText(node: SyntaxNode, plan: SoftRenderPlan): void {
  const text = node.getChild("CodeText");
  if (text) plan.marks.push({ from: text.from, to: text.to, cls: "cm-sr-code-text" });
}

/** 代码行有独立的不透明底色，CodeMirror 选区层会被盖住；在代码文本上补一层可见选区。 */
function markCodeSelection(node: SyntaxNode, cursor: number, selectionTo: number | undefined, plan: SoftRenderPlan): void {
  if (selectionTo === undefined) return;
  const text = node.getChild("CodeText");
  if (!text) return;
  const from = Math.max(text.from, Math.min(cursor, selectionTo));
  const to = Math.min(text.to, Math.max(cursor, selectionTo));
  if (from < to) plan.marks.push({ from, to, cls: "cm-sr-code-selection" });
}

function pushEditWidgets(
  node: SyntaxNode,
  doc: string,
  lines: TextRange[],
  marks: SyntaxNode[],
  plan: SoftRenderPlan,
): void {
  plan.widgets.push(createEditHeaderWidget(node, doc, lines, marks));
  const last = lines[lines.length - 1];
  plan.widgets.push({
    kind: "codeblock-edit-scrollbar",
    from: last?.to ?? node.to,
    to: last?.to ?? node.to,
  });
}

function createEditHeaderWidget(
  node: SyntaxNode,
  doc: string,
  lines: TextRange[],
  marks: SyntaxNode[],
): WidgetRange {
  const text = node.getChild("CodeText");
  const info = node.getChild("CodeInfo");
  return {
    kind: "codeblock-edit-header",
    from: lines[0]?.from ?? node.from,
    to: lines[0]?.from ?? node.from,
    value: text ? doc.slice(text.from, text.to) : "",
    alt: info ? doc.slice(info.from, info.to).trim() : "",
    caret: lines[1]?.from ?? node.from + 1,
    blockTo: node.to,
    ...languageTarget(node, doc, marks),
  };
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

/** 光标是否位于围栏行内部（仅在用户编辑围栏源码时淡显）。 */
function lineHit(line: TextRange | undefined, cursor: number): boolean {
  if (!line) return false;
  // 折叠光标落在围栏行的起止边界时不淡显：隐藏围栏行没有任何可见字符，
  // 点击顶部 / 底部留白经常正好映射到 line.from / line.to，不能因此把 ``` 冒出来。
  return cursor > line.from && cursor < line.to;
}

function planCodeBlockLines(lines: TextRange[], plan: SoftRenderPlan): void {
  lines.forEach((line, index) => {
    plan.gaps.push({ pos: line.from, cls: codeBlockLineClass(index, lines.length) });
  });
}

function codeBlockLineClass(index: number, count: number): string {
  const classes = ["cm-sr-codeblock-line"];
  if (index === 0) classes.push("cm-sr-codeblock-line-first");
  if (index === count - 1) classes.push("cm-sr-codeblock-line-last");
  if (index > 0 && index < count - 1) {
    classes.push("cm-sr-codeblock-body");
    if (index === 1) classes.push("cm-sr-codeblock-body-first");
  }
  return classes.join(" ");
}

function planInactiveCodeBlock(node: SyntaxNode, doc: string, plan: SoftRenderPlan): void {
  const { code, language } = describeCodeBlock(node, doc);
  if (language.toLocaleLowerCase() === "mermaid") {
    plan.widgets.push({ kind: "mermaid", from: node.from, to: node.to, value: code });
  } else {
    const target = languageTarget(node, doc, node.getChildren("CodeMark"));
    // 点击 widget 时直接落到正文首行，不把光标放进围栏（否则围栏会被淡显出来）。
    plan.widgets.push({
      kind: "codeblock",
      from: node.from,
      to: node.to,
      value: code,
      alt: language,
      caret: firstCodeLineStart(node, doc),
      ...target,
    });
  }
}

function languageTarget(
  node: SyntaxNode,
  doc: string,
  marks: SyntaxNode[],
): Pick<WidgetRange, "languageFrom" | "languageTo" | "languageInsertAt"> {
  const info = node.getChild("CodeInfo");
  const fenceEnd = marks[0]?.to ?? node.from + 3;
  if (!info) return { languageInsertAt: fenceEnd };
  const hasLeadingSpace = info.from > fenceEnd && doc[info.from - 1] === " ";
  return { languageFrom: hasLeadingSpace ? info.from - 1 : info.from, languageTo: info.to, languageInsertAt: fenceEnd };
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
