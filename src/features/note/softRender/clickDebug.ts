import { Transaction } from "@codemirror/state";
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
  const raw = positionAtPoint(view, event);
  const rawLine = raw === null ? null : view.state.doc.lineAt(raw);
  const offset = raw !== null && rawLine ? Math.max(0, Math.min(raw - rawLine.from, targetLine.length)) : 0;
  return targetLine.from + offset;
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
