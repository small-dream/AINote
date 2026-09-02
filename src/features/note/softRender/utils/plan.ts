import type { SyntaxNode, Tree } from "@lezer/common";
import type { SoftRenderPlan, TextRange } from "../types";
import { createRangeIndex, type RangeIndex } from "./ranges";
import {
  planBlockquote,
  planFencedCode,
  planHeading,
  planHr,
  planList,
  planSetextHeading,
  planTable,
} from "./blocks";
import { planImage, planInlineCode, planLink, planMarkedPair, planTaskMarker } from "./inline";
import { findAutolinks } from "./autolink";
import { findMathRanges } from "./math";

type NodeHandler = (
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo?: number,
) => void;

const NODE_HANDLERS: Record<string, NodeHandler> = {
  ATXHeading1: planHeading,
  ATXHeading2: planHeading,
  ATXHeading3: planHeading,
  ATXHeading4: planHeading,
  ATXHeading5: planHeading,
  ATXHeading6: planHeading,
  SetextHeading1: planSetextHeading,
  SetextHeading2: planSetextHeading,
  StrongEmphasis: (n, _d, _c, p) => planMarkedPair(n, "EmphasisMark", "cm-sr-strong", p),
  Emphasis: (n, _d, _c, p) => planMarkedPair(n, "EmphasisMark", "cm-sr-em", p),
  Strikethrough: (n, _d, _c, p) => planMarkedPair(n, "StrikethroughMark", "cm-sr-strike", p),
  InlineCode: planInlineCode,
  FencedCode: planFencedCode,
  Blockquote: planBlockquote,
  BulletList: (n, d, c, p, s) => planList(n, d, c, p, "bullet", s),
  OrderedList: (n, d, c, p, s) => planList(n, d, c, p, "ordered", s),
  Image: planImage,
  Link: planLink,
  TaskMarker: planTaskMarker,
  HorizontalRule: planHr,
  Table: planTable,
};

/** 生成 Markdown 软渲染计划：源码保持原样，仅用 decoration/widget 覆盖显示。 */
export function planSoftRender(tree: Tree, doc: string, cursor: number, selectionTo?: number): SoftRenderPlan {
  const plan = createEmptyPlan();
  const codeRanges = collectCodeRanges(tree);
  const linkRanges = collectLinkRanges(tree);
  planWikiLinks(doc, plan, createRangeIndex(codeRanges));
  planMathAndAutolink(doc, cursor, plan, codeRanges, linkRanges, selectionTo);
  const protectedIndex = createRangeIndex([...plan.wikiRanges, ...plan.mathRanges]);
  walk(tree.topNode, doc, cursor, plan, selectionTo, protectedIndex);
  return plan;
}

function createEmptyPlan(): SoftRenderPlan {
  return { marks: [], hides: [], widgets: [], blocks: [], wikiRanges: [], mathRanges: [] };
}

const WIKI_LINK_RE = /\[\[([^\]\n|]+)(?:\|([^\]\n]+?))?\]\]/g;

function collectCodeRanges(tree: Tree): TextRange[] {
  const ranges: TextRange[] = [];
  function collect(node: SyntaxNode): void {
    if (node.name === "FencedCode" || node.name === "InlineCode") {
      ranges.push({ from: node.from, to: node.to });
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) collect(child);
  }
  collect(tree.topNode);
  return ranges;
}

function collectLinkRanges(tree: Tree): TextRange[] {
  const ranges: TextRange[] = [];
  function collect(node: SyntaxNode): void {
    if (node.name === "Link") {
      ranges.push({ from: node.from, to: node.to });
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) collect(child);
  }
  collect(tree.topNode);
  return ranges;
}

function planWikiLinks(doc: string, plan: SoftRenderPlan, codeIndex: RangeIndex): void {
  for (const match of doc.matchAll(WIKI_LINK_RE)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (codeIndex.contains(from, to)) continue;
    addWikiLink(plan, from, match[0].length, match[1] ?? "", match[2]);
  }
}

function addWikiLink(
  plan: SoftRenderPlan,
  from: number,
  length: number,
  rawTarget: string,
  alias: string | undefined,
): void {
  const to = from + length;
  const target = rawTarget.trim();
  const aliasStart = alias === undefined ? -1 : from + 2 + rawTarget.length + 1;
  const labelFrom = alias === undefined ? from + 2 : aliasStart;
  const labelTo = to - 2;
  if (!target || labelFrom >= labelTo) return;
  plan.hides.push({ from, to: from + 2, reveal: false });
  if (alias !== undefined) plan.hides.push({ from: from + 2, to: aliasStart, reveal: false });
  plan.hides.push({ from: to - 2, to, reveal: false });
  plan.marks.push({
    from: labelFrom,
    to: labelTo,
    cls: "cm-sr-wikilink",
    attrs: { "data-sr-target": target },
  });
  plan.wikiRanges.push({ from, to });
}

function planMathAndAutolink(
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  codeRanges: TextRange[],
  linkRanges: TextRange[],
  selectionTo?: number,
): void {
  const baseIndex = createRangeIndex([...codeRanges, ...linkRanges, ...plan.wikiRanges]);
  const mathRanges = findMathRanges(doc, baseIndex);
  for (const range of mathRanges) {
    plan.mathRanges.push({ from: range.from, to: range.to });
    if (activeMathRange(range.from, range.to, cursor, selectionTo)) continue;
    plan.widgets.push({
      kind: "math",
      from: range.from,
      to: range.to,
      value: range.source,
      mode: range.mode,
    });
  }
  const autolinkIndex = createRangeIndex([...codeRanges, ...linkRanges, ...plan.wikiRanges, ...plan.mathRanges]);
  for (const link of findAutolinks(doc, autolinkIndex)) {
    plan.marks.push({
      from: link.from,
      to: link.to,
      cls: "cm-sr-autolink",
      attrs: { "data-sr-href": link.href },
    });
  }
}

function activeMathRange(from: number, to: number, cursor: number, selectionTo?: number): boolean {
  if (selectionTo === undefined) return cursor >= from && cursor <= to;
  const start = Math.min(cursor, selectionTo);
  const end = Math.max(cursor, selectionTo);
  return start <= to && end >= from;
}

function walk(
  node: SyntaxNode,
  doc: string,
  cursor: number,
  plan: SoftRenderPlan,
  selectionTo: number | undefined,
  protectedIndex: RangeIndex,
): void {
  if (protectedIndex.contains(node.from, node.to)) return;
  const handler = NODE_HANDLERS[node.name];
  if (handler) handler(node, doc, cursor, plan, selectionTo);
  for (let child = node.firstChild; child; child = child.nextSibling) {
    walk(child, doc, cursor, plan, selectionTo, protectedIndex);
  }
}
