import type { SoftRenderPlan, TextRange } from "../types";
import { createRangeIndex, isActiveRange, type RangeIndex } from "./ranges";

/** GFM 脚注定义：`[^label]: 内容`（允许 0–3 个前导空格）。 */
const DEFINITION_RE = /^( {0,3})\[\^([^\]\s]+)\]:[ \t]*/;
/** GFM 脚注引用：`[^label]`。remark-gfm 中 `[^1](url)` 也是脚注 + 文本，不按链接处理。 */
const REFERENCE_RE = /\[\^([^\]\s]+)\]/g;
/** GFM 定义的续行必须缩进 4 个空格或一个 tab；2 空格缩进是新的块。 */
const CONTINUATION_RE = /^(?: {4,}|\t)/;

interface FootnoteDefinition {
  label: string;
  markerFrom: number;
  markerTo: number;
  blockFrom: number;
  blockTo: number;
}

interface FootnoteReference {
  label: string;
  from: number;
  to: number;
}

/** GFM 脚注标签大小写不敏感。 */
function labelKey(label: string): string {
  return label.toLocaleLowerCase();
}

/** 脚注扫描的上下文保护区，语义对齐 remark-gfm： */
export interface FootnoteScanContext {
  /** 完全保护区：代码块 / wiki 链接 / 数学公式内的 [^x] 不是引用。 */
  protectedRanges: TextRange[];
  /** 图片语法范围：alt 是纯文本，其中的 [^x] 不是引用。 */
  imageRanges: TextRange[];
  /** 转义符范围：`\[^1]` 是字面文本；`\\[^1]` 里转义只吃掉前一个反斜杠。 */
  escapeRanges: TextRange[];
  /** 链接语法范围：URL 里的 [^x] 不是引用；`[^1](url)` 整体是 Link 节点且引用恰从链接起点开始，按脚注 + 文本处理。 */
  linkRanges: TextRange[];
  /** 光标所在表格：引用计入编号但保持源码，避免编辑态所见非所得。 */
  revealRanges: TextRange[];
}

/**
 * 软渲染脚注（对齐 GitHub / remark-gfm）：
 * - 引用 `[^label]` 按首次引用顺序编号后渲染为 `[n]`；
 * - 定义标记替换为同序号 `n.`，整块降级为脚注小字；
 * - 未被引用的定义保持源码原样；没有定义的引用也保持源码；
 * - 光标进入引用/定义标记时不做替换，保留源码用于编辑；
 * - 引用落在图片 alt、链接 URL、转义符之后保持源码且不计入编号；
 * - 光标所在表格内的引用/定义保持源码但仍计入编号。
 *
 * 脚注不是 GFM CommonMark 节点，Lezer 会把定义解析成 LinkReference / Paragraph，
 * 因此按源码扫描，避免依赖语法树的两种不同形态。
 */
export function planFootnotes(
  doc: string,
  plan: SoftRenderPlan,
  context: FootnoteScanContext,
  cursor: number,
  selectionTo?: number,
): void {
  const baseIndex = createRangeIndex(context.protectedRanges);
  const definitions = collectDefinitions(doc, baseIndex);
  const markerIndex = createRangeIndex(definitions.map((definition) => ({
    from: definition.markerFrom,
    to: definition.markerTo,
  })));
  const refs = collectReferences(doc, baseIndex, markerIndex, context);
  const labels = new Set(definitions.map((definition) => labelKey(definition.label)));
  const referenced = refs.filter((ref) => labels.has(labelKey(ref.label)));

  const numbering = new Map<string, number>();
  for (const ref of referenced) {
    const key = labelKey(ref.label);
    if (!numbering.has(key)) numbering.set(key, numbering.size + 1);
  }
  const revealIndex = createRangeIndex(context.revealRanges);
  for (const ref of referenced) {
    if (isActiveRange(ref.from, ref.to, cursor, selectionTo)) continue;
    if (revealIndex.contains(ref.from, ref.to)) continue;
    plan.widgets.push({ kind: "footnote-ref", from: ref.from, to: ref.to, value: String(numbering.get(labelKey(ref.label))) });
  }
  for (const definition of definitions) {
    const index = numbering.get(labelKey(definition.label));
    if (index === undefined) continue;
    if (!revealIndex.contains(definition.blockFrom, definition.blockTo)) {
      plan.blocks.push({ from: definition.blockFrom, to: definition.blockTo, cls: "cm-sr-footnote-def" });
    }
    if (isActiveRange(definition.markerFrom, definition.markerTo, cursor, selectionTo)) continue;
    if (revealIndex.contains(definition.markerFrom, definition.markerTo)) continue;
    plan.widgets.push({
      kind: "footnote-def",
      from: definition.markerFrom,
      to: definition.markerTo,
      value: String(index),
    });
  }
}

function collectDefinitions(doc: string, protectedIndex: RangeIndex): FootnoteDefinition[] {
  const definitions: FootnoteDefinition[] = [];
  let lineStart = 0;
  while (lineStart <= doc.length) {
    const lineEnd = lineEndAt(doc, lineStart);
    const line = doc.slice(lineStart, lineEnd);
    const match = DEFINITION_RE.exec(line);
    if (match && !protectedIndex.contains(lineStart, lineEnd)) {
      const label = match[2] ?? "";
      const markerFrom = lineStart + (match[1]?.length ?? 0);
      const markerTo = lineStart + match[0].length;
      const definitionEnd = definitionEndAt(doc, lineEnd);
      definitions.push({ label, markerFrom, markerTo, blockFrom: lineStart, blockTo: definitionEnd });
      lineStart = definitionEnd + 1;
      continue;
    }
    lineStart = lineEnd + 1;
  }
  return definitions;
}

function collectReferences(
  doc: string,
  protectedIndex: RangeIndex,
  markerIndex: RangeIndex,
  context: FootnoteScanContext,
): FootnoteReference[] {
  const imageIndex = createRangeIndex(context.imageRanges);
  const escapeIndex = createRangeIndex(context.escapeRanges);
  const refs: FootnoteReference[] = [];
  for (const match of doc.matchAll(REFERENCE_RE)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (protectedIndex.contains(from, to) || markerIndex.contains(from, to)) continue;
    if (imageIndex.contains(from, to)) continue;
    if (insideLinkContent(context.linkRanges, from, to)) continue;
    // 引用的 `[` 被转义（Escape 节点覆盖该字符）时是字面文本；
    // `\\[^1]` 的 Escape 只覆盖第一个反斜杠，随后的引用不受影响。
    if (escapeIndex.contains(from, from + 1)) continue;
    refs.push({ label: match[1] ?? "", from, to });
  }
  return refs;
}

/** 链接内容判定：引用恰从链接起点开始时是 `[^1](url)` 形态，按脚注 + 文本处理。 */
function insideLinkContent(linkRanges: TextRange[], from: number, to: number): boolean {
  return linkRanges.some((link) => link.from < from && link.to >= to);
}

/** 定义的续行：空行后仍缩进（4 空格 / tab）的行继续归属该脚注；遇到其他块结束。 */
function definitionEndAt(doc: string, firstLineEnd: number): number {
  let end = firstLineEnd;
  let cursor = firstLineEnd + 1;
  while (cursor <= doc.length) {
    const lineEnd = lineEndAt(doc, cursor);
    const line = doc.slice(cursor, lineEnd);
    if (line.trim() === "") {
      cursor = lineEnd + 1;
      continue;
    }
    if (!CONTINUATION_RE.test(line)) break;
    end = lineEnd;
    cursor = lineEnd + 1;
  }
  return end;
}

function lineEndAt(doc: string, from: number): number {
  const newline = doc.indexOf("\n", from);
  return newline === -1 ? doc.length : newline;
}
