import type { SyntaxNode } from "@lezer/common";
import { GFM, parser } from "@lezer/markdown";
import { labelKey } from "../utils/footnotes";

const inlineParser = parser.configure([GFM]);

/** 单元格内成形的脚注引用 `[^label]`（Lezer 把它解析成无 URL 的 Link / LinkReference）。 */
const FOOTNOTE_CELL_RE = /^\[\^([^\]\s]+)\]$/;

interface InlineSegment {
  /** Start offset in the rendered text content. */
  start: number;
  length: number;
  /** Source offset of the first rendered character in this segment. */
  sourceStart: number;
}

interface InlineRenderIndex {
  segments: InlineSegment[];
  length: number;
}

const renderIndexes = new WeakMap<HTMLElement, InlineRenderIndex>();

/** Render inline Markdown inside a table cell without exposing source markers. */
export function renderTableInline(target: HTMLElement, source: string, footnotes?: Map<string, string>): void {
  target.replaceChildren();
  const index: InlineRenderIndex = { segments: [], length: 0 };
  if (source) appendRange(target, source, inlineParser.parse(source).topNode, 0, source.length, index, footnotes);
  renderIndexes.set(target, index);
}

/** Map a caret offset in the rendered cell text back to the Markdown source offset. */
export function sourceOffsetAtRendered(target: HTMLElement, renderedOffset: number): number | null {
  const index = renderIndexes.get(target);
  if (!index) return null;
  if (index.segments.length === 0) return 0;
  const offset = Math.max(0, Math.min(renderedOffset, index.length));
  for (let i = 0; i < index.segments.length; i += 1) {
    const segment = index.segments[i] as InlineSegment;
    const isLast = i === index.segments.length - 1;
    if (offset < segment.start + segment.length || (isLast && offset === segment.start + segment.length)) {
      return segment.sourceStart + Math.max(0, offset - segment.start);
    }
  }
  const last = index.segments[index.segments.length - 1] as InlineSegment;
  return last.sourceStart + last.length;
}

/** Caret offset inside the element's rendered text for a viewport point, or null when unsupported. */
export function renderedOffsetAtPoint(target: HTMLElement, x: number, y: number): number | null {
  const doc = target.ownerDocument as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let range: Range | null;
  try {
    range = doc.caretRangeFromPoint?.(x, y) ?? null;
    if (!range) {
      const caret = doc.caretPositionFromPoint?.(x, y);
      if (caret) {
        range = doc.createRange();
        range.setStart(caret.offsetNode, caret.offset);
      }
    }
    if (!range || !target.contains(range.startContainer)) return null;
    const pre = doc.createRange();
    pre.selectNodeContents(target);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  } catch {
    return null;
  }
}

function appendRange(
  parent: HTMLElement,
  source: string,
  node: SyntaxNode,
  from: number,
  to: number,
  index: InlineRenderIndex,
  footnotes?: Map<string, string>,
): void {
  let position = from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue;
    if (child.from > position) emitText(parent, source, position, child.from, index);
    appendNode(parent, source, child, index, footnotes);
    position = Math.max(position, child.to);
  }
  if (position < to) emitText(parent, source, position, to, index);
}

function emitText(parent: HTMLElement, source: string, from: number, to: number, index: InlineRenderIndex): void {
  const text = source.slice(from, to);
  if (!text) return;
  parent.append(document.createTextNode(text));
  index.segments.push({ start: index.length, length: text.length, sourceStart: from });
  index.length += text.length;
}

function appendNode(
  parent: HTMLElement,
  source: string,
  node: SyntaxNode,
  index: InlineRenderIndex,
  footnotes?: Map<string, string>,
): void {
  switch (node.name) {
    case "Document":
    case "Paragraph":
      appendRange(parent, source, node, node.from, node.to, index, footnotes);
      return;
    case "StrongEmphasis":
      appendMarked(parent, source, node, "EmphasisMark", "strong", "cm-sr-strong", index, footnotes);
      return;
    case "Emphasis":
      appendMarked(parent, source, node, "EmphasisMark", "em", "cm-sr-em", index, footnotes);
      return;
    case "Strikethrough":
      appendMarked(parent, source, node, "StrikethroughMark", "del", "cm-sr-strike", index, footnotes);
      return;
    case "InlineCode":
      appendInlineCode(parent, source, node, index);
      return;
    case "Link":
    case "LinkReference":
      appendLinkOrFootnote(parent, source, node, index, footnotes);
      return;
    case "Autolink":
      appendAutolink(parent, source, node, index);
      return;
    case "Escape":
      emitText(parent, source, Math.min(node.from + 1, node.to), node.to, index);
      return;
    default:
      emitText(parent, source, node.from, node.to, index);
  }
}

/** 链接 / 引用节点：整体恰是 `[^label]` 时按单元格脚注上标渲染；否则按链接（或字面文本）。 */
function appendLinkOrFootnote(
  parent: HTMLElement,
  source: string,
  node: SyntaxNode,
  index: InlineRenderIndex,
  footnotes?: Map<string, string>,
): void {
  if (FOOTNOTE_CELL_RE.test(source.slice(node.from, node.to))) {
    appendFootnoteRef(parent, source, node, index, footnotes);
    return;
  }
  if (node.name === "Link") {
    appendLink(parent, source, node, index, footnotes);
    return;
  }
  emitText(parent, source, node.from, node.to, index);
}

/** 单元格内的 `[^label]`：查得到编号时渲染为与编辑区一致的 `[n]` 上标；查不到保持源码。 */
function appendFootnoteRef(
  parent: HTMLElement,
  source: string,
  node: SyntaxNode,
  index: InlineRenderIndex,
  footnotes?: Map<string, string>,
): void {
  const label = labelKey(source.slice(node.from + 2, node.to - 1));
  const number = footnotes?.get(label);
  if (number === undefined) {
    emitText(parent, source, node.from, node.to, index);
    return;
  }
  const span = document.createElement("span");
  span.className = "cm-sr-footnote-ref";
  span.textContent = `[${number}]`;
  parent.append(span);
  // 渲染文本与源码长度不同（[n] vs [^label]）：记录一段线性映射，点击序号时光标落回引用源码内。
  index.segments.push({ start: index.length, length: span.textContent.length, sourceStart: node.from });
  index.length += span.textContent.length;
}

function appendMarked(
  parent: HTMLElement,
  source: string,
  node: SyntaxNode,
  markName: string,
  tag: "strong" | "em" | "del",
  className: string,
  index: InlineRenderIndex,
  footnotes?: Map<string, string>,
): void {
  const marks = node.getChildren(markName);
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) {
    emitText(parent, source, node.from, node.to, index);
    return;
  }
  const element = document.createElement(tag);
  element.className = className;
  appendRange(element, source, node, first.to, last.from, index, footnotes);
  parent.append(element);
}

function appendInlineCode(parent: HTMLElement, source: string, node: SyntaxNode, index: InlineRenderIndex): void {
  const marks = node.getChildren("CodeMark");
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) {
    emitText(parent, source, node.from, node.to, index);
    return;
  }
  const code = document.createElement("code");
  code.className = "cm-sr-inline-code";
  emitText(code, source, first.to, last.from, index);
  parent.append(code);
}

function appendLink(parent: HTMLElement, source: string, node: SyntaxNode, index: InlineRenderIndex, footnotes?: Map<string, string>): void {
  const url = node.getChild("URL");
  const marks = node.getChildren("LinkMark");
  const first = marks[0];
  const second = marks[1];
  if (!url || !first || !second) {
    emitText(parent, source, node.from, node.to, index);
    return;
  }
  const link = document.createElement("span");
  link.className = "cm-sr-link";
  link.dataset.srHref = source.slice(url.from, url.to);
  appendRange(link, source, node, first.to, second.from, index, footnotes);
  parent.append(link);
}

function appendAutolink(parent: HTMLElement, source: string, node: SyntaxNode, index: InlineRenderIndex): void {
  const url = node.getChild("URL");
  if (!url) {
    emitText(parent, source, node.from, node.to, index);
    return;
  }
  const href = source.slice(url.from, url.to);
  const link = document.createElement("span");
  link.className = "cm-sr-link";
  link.dataset.srHref = href;
  emitText(link, source, url.from, url.to, index);
  parent.append(link);
}
