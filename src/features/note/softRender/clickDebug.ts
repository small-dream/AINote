import { Transaction, type Line } from "@codemirror/state";
import type { ViewUpdate, EditorView } from "@codemirror/view";

interface ClickDebugOptions {
  debugClick?: boolean;
}

/** 输出软渲染点击的事件、坐标映射和最终 selection，默认仅开发环境开启。 */
export function debugMouseDown(event: MouseEvent, view: EditorView, options: ClickDebugOptions): boolean {
  debugClick("mousedown", event, view, options);
  return false;
}

export function debugViewUpdate(update: ViewUpdate, options: ClickDebugOptions): void {
  if (!(options.debugClick ?? import.meta.env.DEV) || !update.transactions.some((transaction) => transaction.selection)) return;
  const selection = update.state.selection.main;
  console.debug("[AINote soft-render click]", {
    label: "selection:update",
    selection: {
      from: selection.from,
      to: selection.to,
      head: selection.head,
      line: update.state.doc.lineAt(selection.head).number,
    },
    previous: {
      head: update.startState.selection.main.head,
      line: update.startState.doc.lineAt(update.startState.selection.main.head).number,
    },
    transactions: update.transactions.map((transaction) => ({
      selectionSet: transaction.selection,
      docChanged: transaction.docChanged,
      userEvent: transaction.annotation(Transaction.userEvent) || undefined,
    })),
    scrollTop: update.view.scrollDOM.scrollTop,
  });
}

export function debugClick(label: string, event: MouseEvent, view: EditorView, options: ClickDebugOptions): void {
  if (!(options.debugClick ?? import.meta.env.DEV)) return;
  const line = lineElementForTarget(event.target);
  const rect = line?.getBoundingClientRect();
  const domLine = describeDOMLine(view, line);
  const raw = safePositionAtCoords(view, { x: event.clientX, y: event.clientY });
  const center = getCenterPosition(view, event, rect);
  console.debug("[AINote soft-render click]", {
    label,
    detail: event.detail,
    clientX: event.clientX,
    clientY: event.clientY,
    target: describeClickTarget(event.target),
    line: line ? { text: line.textContent, top: rect?.top, bottom: rect?.bottom, height: rect?.height } : null,
    domLine,
    raw: describePosition(view, raw),
    center: describePosition(view, center),
    selection: describePosition(view, { pos: view.state.selection.main.head, assoc: 0 }),
    scrollTop: view.scrollDOM.scrollTop,
  });
}

function describeDOMLine(view: EditorView, line: HTMLElement | null): { from: number; to: number; line: number } | null {
  if (!line) return null;
  try {
    const from = view.posAtDOM(line, 0);
    const docLine = view.state.doc.lineAt(from);
    return { from: docLine.from, to: docLine.to, line: docLine.number };
  } catch {
    return null;
  }
}

function getCenterPosition(view: EditorView, event: MouseEvent, rect: DOMRect | undefined) {
  if (!rect || rect.height <= 0 || rect.height > view.defaultLineHeight * 1.5) return null;
  return safePositionAtCoords(view, { x: event.clientX, y: rect.top + rect.height / 2 });
}

function safePositionAtCoords(view: EditorView, coords: { x: number; y: number }) {
  try {
    return view.posAndSideAtCoords(coords, false);
  } catch {
    return null;
  }
}

function describePosition(view: EditorView, position: { pos: number; assoc: number } | null) {
  return position ? { pos: position.pos, assoc: position.assoc, line: view.state.doc.lineAt(position.pos).number } : null;
}

export function lineElementForTarget(target: EventTarget | null): HTMLElement | null {
  return closestElement(target, ".cm-line");
}

export function clickedLinePosition(view: EditorView, event: MouseEvent): number | null {
  const line = lineElementForTarget(event.target);
  if (!line) return null;
  const lineStart = safePosAtDOM(view, line);
  if (lineStart === null) return null;
  const targetLine = view.state.doc.lineAt(lineStart);
  const pos = rawClickPosition(view, targetLine, event);
  // 点在可见文字右侧（含行尾空白）时改用 CodeMirror 自己的坐标映射：
  // WebKit 的 caretRangeFromPoint 在行尾会落到隐藏标记之后（源码行尾），
  // 于是「光标在最右边继续输入」会跳出行内样式（例如加粗失效）。
  const visible = visibleRowExtents(line, event.clientY);
  if (visible && event.clientX > visible.right) {
    return edgePosition(view, visible.right + 1, event.clientY) ?? pos;
  }
  return pos;
}

/** 浏览器 caret 映射出的光标位置（按命中行夹紧）。 */
function rawClickPosition(view: EditorView, targetLine: Line, event: MouseEvent): number {
  const raw = positionAtPoint(view, event);
  const rawLine = raw === null ? null : view.state.doc.lineAt(raw);
  const offset = raw !== null && rawLine ? Math.max(0, Math.min(raw - rawLine.from, targetLine.length)) : 0;
  return targetLine.from + offset;
}

/** 可见内容（正文与 widget）在点击所在视觉行内的左右边界；整行都没有可见内容时返回 null。 */
function visibleRowExtents(line: HTMLElement, clickY: number): { left: number; right: number } | null {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  for (const box of visibleTextBoxes(line, clickY)) {
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
  }
  for (const widget of line.querySelectorAll<HTMLElement>("[data-sr-from]")) {
    const box = widget.getBoundingClientRect();
    if (clickY < box.top || clickY > box.bottom) continue;
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
  }
  return right >= left ? { left, right } : null;
}

/** 可见正文的矩形（软换行时按视觉行拆分；隐藏标记已从 DOM 移除，不参与测量）。 */
function visibleTextBoxes(line: HTMLElement, clickY: number): DOMRect[] {
  const boxes: DOMRect[] = [];
  const walker = line.ownerDocument.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = line.ownerDocument.createRange();
    range.selectNodeContents(node);
    for (const box of clientRects(range)) {
      if (clickY >= box.top && clickY <= box.bottom) boxes.push(box);
    }
  }
  return boxes;
}

/** 无布局能力的环境（如 jsdom）没有 Range.getClientRects，此时按无矩形处理。 */
function clientRects(range: Range): DOMRect[] {
  try {
    return Array.from(range.getClientRects());
  } catch {
    return [];
  }
}

/** 让 CodeMirror 算「可见右边界处的光标位置」，避免内核在行尾给出跳出行内样式的位置。 */
function edgePosition(view: EditorView, x: number, y: number): number | null {
  try {
    const pos = view.posAtCoords({ x, y }, false);
    return pos === null ? null : Math.max(0, Math.min(pos, view.state.doc.length));
  } catch {
    return null;
  }
}

function positionAtPoint(view: EditorView, event: MouseEvent): number | null {
  const documentWithCaret = view.dom.ownerDocument as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  try {
    const range = documentWithCaret.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (range) return view.posAtDOM(range.startContainer, range.startOffset);
    const caret = documentWithCaret.caretPositionFromPoint?.(event.clientX, event.clientY);
    if (caret) return view.posAtDOM(caret.offsetNode, caret.offset);
  } catch {
    // 回退到 CodeMirror 自身的坐标映射。
  }
  return safePosAtCoords(view, event);
}

function safePosAtDOM(view: EditorView, line: HTMLElement): number | null {
  try {
    return view.posAtDOM(line, 0);
  } catch {
    return null;
  }
}

function safePosAtCoords(view: EditorView, event: MouseEvent): number | null {
  try {
    return view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
  } catch {
    return null;
  }
}

function closestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  if (target instanceof HTMLElement) return target.closest<HTMLElement>(selector);
  if (target instanceof Node) return target.parentElement?.closest<HTMLElement>(selector) ?? null;
  return null;
}

function describeClickTarget(target: EventTarget | null): string {
  if (target instanceof HTMLElement) return `${target.tagName.toLowerCase()}${target.className ? `.${String(target.className).replace(/\s+/g, ".")}` : ""}`;
  if (target instanceof Text) return "#text";
  return target?.constructor?.name ?? "null";
}
