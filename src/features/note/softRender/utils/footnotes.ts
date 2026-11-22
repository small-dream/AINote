import type { SoftRenderPlan, TextRange } from "../types";
import { createRangeIndex, isActiveRange, type RangeIndex } from "./ranges";

/** GFM 脚注定义：`[^label]: 内容`（允许 0–3 个前导空格）。 */
const DEFINITION_RE = /^( {0,3})\[\^([^\]\s]+)\]:[ \t]*/;
/** 容器行前缀（引用 `>` / 无序与有序列表标记，可嵌套）：GitHub 在容器首行同样识别脚注定义。
 *  `>` 之后只消耗一个空白（CommonMark 行为），剩余缩进留给内容判定（续行 4 空格规则要用）。 */
const CONTAINER_PREFIX_RE = /^(?: {0,3}>[ \t]?| {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+)/;
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
  /** false = 计入编号但保持源码（嵌在未渲染的链接语法里，见 insideRawLinkSyntax）。 */
  renderable: boolean;
}

/** GFM 脚注标签大小写不敏感；表格内联渲染查号时同样用它归一化。 */
export function labelKey(label: string): string {
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
 * - 光标所在表格内的引用/定义保持源码但仍计入编号；
 * - 引用嵌在未渲染的链接语法（如 `[see [^1] end](u)`）里时保持源码但仍计入编号；
 * - 引用块 / 列表项首行的定义同样识别（GitHub 对齐）。
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
    // 嵌在未渲染链接语法里的引用照常计号但不替换（GitHub 渲染为链接内上标，Lezer 造不出外层 Link）。
    if (!ref.renderable) continue;
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
    if (!protectedIndex.contains(lineStart, lineEnd)) {
      const match = matchDefinitionLine(doc, lineStart, lineEnd);
      if (match) {
        const blockTo = definitionEndAt(doc, lineEnd, match.prefixLength);
        definitions.push({ label: match.label, markerFrom: match.markerFrom, markerTo: match.markerTo, blockFrom: lineStart, blockTo });
        lineStart = blockTo + 1;
        continue;
      }
    }
    lineStart = lineEnd + 1;
  }
  return definitions;
}

/**
 * 表格单元格内联渲染的查号表：label（大小写归一）→ 序号。
 * 取自 plan 的 footnote-ref widget（其 from..to 恰是源码 `[^label]`）。光标所在表格不建
 * TableWidget，因此凡有表格 widget 时查号表必然覆盖全部被引用标签；
 * 取不到号（多表格同时处于选区等边缘）时单元格回退源码文本。
 */
export function footnoteNumbering(doc: string, widgets: SoftRenderPlan["widgets"]): Map<string, string> {
  const numbering = new Map<string, string>();
  for (const widget of widgets) {
    if (widget.kind !== "footnote-ref") continue;
    numbering.set(labelKey(doc.slice(widget.from + 2, widget.to - 1)), widget.value ?? "");
  }
  return numbering;
}

interface DefinitionMatch {
  label: string;
  markerFrom: number;
  markerTo: number;
  /** 行首容器前缀总长（源坐标）：容器内定义的续行判定要用。 */
  prefixLength: number;
}

/** 行首剥除容器前缀（> / 列表标记，可嵌套）后按原正则匹配定义，marker 偏移换算回源坐标。 */
function matchDefinitionLine(doc: string, lineStart: number, lineEnd: number): DefinitionMatch | null {
  const line = doc.slice(lineStart, lineEnd);
  const prefixLength = stripContainerPrefixes(line);
  const match = DEFINITION_RE.exec(line.slice(prefixLength));
  if (!match) return null;
  const offset = lineStart + prefixLength;
  return {
    label: match[2] ?? "",
    markerFrom: offset + (match[1]?.length ?? 0),
    markerTo: offset + match[0].length,
    prefixLength,
  };
}

/** 返回行首容器前缀总长；`>` 可不带空格跟随，列表标记后必须跟空白。 */
function stripContainerPrefixes(line: string): number {
  let length = 0;
  for (;;) {
    const match = CONTAINER_PREFIX_RE.exec(line.slice(length));
    if (!match) break;
    length += match[0].length;
  }
  return length;
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
    refs.push({ label: match[1] ?? "", from, to, renderable: !insideRawLinkSyntax(doc, from, to) });
  }
  return refs;
}

/**
 * 引用是否嵌在 Lezer 未渲染成 Link 的行内链接语法里（如 `[see [^1] end](u)`）：
 * 前方有未闭合的 `[`、其后在同一行闭合并紧跟 `(`。remark-gfm 把它渲染为「链接内上标」，
 * 但 Lezer 对嵌套中括号链接不产出外层 Link 节点，替换会得到「链接裸露 + [1] 替换」的混合态；
 * 此时引用照常计入编号（对齐 GitHub），仅保持源码不替换。
 */
function insideRawLinkSyntax(doc: string, from: number, to: number): boolean {
  const lineStart = doc.lastIndexOf("\n", from - 1) + 1;
  const newline = doc.indexOf("\n", to);
  const line = doc.slice(lineStart, newline === -1 ? doc.length : newline);
  let depth = 0;
  for (let i = 0; i < from - lineStart; i += 1) {
    const char = line[i];
    if (char === "\\") i += 1;
    else if (char === "[") depth += 1;
    else if (char === "]") depth = Math.max(0, depth - 1);
  }
  if (depth === 0) return false;
  for (let i = to - lineStart; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\\") i += 1;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return line[i + 1] === "(";
    }
  }
  return false;
}

/** 链接内容判定：引用恰从链接起点开始时是 `[^1](url)` 形态，按脚注 + 文本处理。 */
function insideLinkContent(linkRanges: TextRange[], from: number, to: number): boolean {
  return linkRanges.some((link) => link.from < from && link.to >= to);
}

/** 定义的续行：空行后仍缩进（4 空格 / tab）的行继续归属该脚注；遇到其他块结束。
 *  容器内定义的续行另需剥除本行容器前缀后再判缩进（`> ` 单独成行算容器内空行）；
 *  真空行会关掉引用块/列表项，容器内定义到此为止。 */
function definitionEndAt(doc: string, firstLineEnd: number, prefixLength: number): number {
  let end = firstLineEnd;
  let cursor = firstLineEnd + 1;
  while (cursor <= doc.length) {
    const lineEnd = lineEndAt(doc, cursor);
    const line = doc.slice(cursor, lineEnd);
    if (line.trim() === "") {
      if (prefixLength > 0) break;
      cursor = lineEnd + 1;
      continue;
    }
    if (CONTINUATION_RE.test(line) || (prefixLength > 0 && continuesInContainer(line))) {
      end = lineEnd;
      cursor = lineEnd + 1;
      continue;
    }
    break;
  }
  return end;
}

/** 容器定义的续行：剥除本行容器前缀后是空行或 4 空格缩进。 */
function continuesInContainer(line: string): boolean {
  const content = line.slice(stripContainerPrefixes(line));
  return content.trim() === "" || CONTINUATION_RE.test(content);
}

function lineEndAt(doc: string, from: number): number {
  const newline = doc.indexOf("\n", from);
  return newline === -1 ? doc.length : newline;
}
