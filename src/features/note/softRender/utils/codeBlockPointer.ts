import { EditorView, ViewPlugin } from "@codemirror/view";

const INTERACTIVE = "button, select, input, textarea, a, label, [role='scrollbar'], .cm-gutters, .cm-tooltip";

interface ActiveBlock {
  header: HTMLElement;
  footer: HTMLElement | null;
  bottom: number;
}

/** 在 CodeMirror 处理鼠标按下前接管代码块空白区域，避免把光标落到替换 widget 边界。 */
export const codeBlockPointer = ViewPlugin.fromClass(class {
  private readonly onMouseDown = (event: MouseEvent): void => {
    handleCodeBlockMouseDown(event, this.view);
  };

  constructor(private readonly view: EditorView) {
    view.scrollDOM.addEventListener("mousedown", this.onMouseDown, true);
  }

  destroy(): void {
    this.view.scrollDOM.removeEventListener("mousedown", this.onMouseDown, true);
  }
});

function handleCodeBlockMouseDown(event: MouseEvent, view: EditorView): void {
  if (!isPlainPrimaryClick(event) || isInteractive(event.target)) return;
  if (isVerticalScrollbar(event, view)) return;
  if (event.target instanceof Element && event.target.closest(".cm-line.cm-sr-codeblock-body")) return;

  const inactive = inactiveCodeBlockAt(event, view);
  if (inactive) {
    consume(event);
    enterInactiveCodeBlock(inactive, view);
    return;
  }

  const active = activeCodeBlockAt(event, view);
  if (!active) return;
  const line = nearestCodeLine(event.clientY, active, view);
  if (!line) return;
  consume(event);
  focusCodeLine(event, line, view);
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !(event.shiftKey || event.altKey || event.ctrlKey || event.metaKey);
}

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE));
}

function isVerticalScrollbar(event: MouseEvent, view: EditorView): boolean {
  const scroller = view.scrollDOM;
  const rect = scroller.getBoundingClientRect();
  const scrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
  return scrollbarWidth > 0 && event.clientX >= rect.left + scroller.clientWidth;
}

function inactiveCodeBlockAt(event: MouseEvent, view: EditorView): HTMLElement | null {
  const scroller = view.scrollDOM.getBoundingClientRect();
  if (event.clientX < scroller.left || event.clientX > scroller.right) return null;
  for (const widget of view.contentDOM.querySelectorAll<HTMLElement>(".cm-sr-codeblock-widget[data-sr-from]")) {
    const box = widget.getBoundingClientRect();
    if (event.clientY >= box.top && event.clientY <= box.bottom) return widget;
  }
  return null;
}

function activeCodeBlockAt(event: MouseEvent, view: EditorView): ActiveBlock | null {
  const headers = Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-sr-codeblock-header"))
    .filter((header) => !header.closest(".cm-sr-codeblock-widget"));
  const footers = Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-sr-codeblock-footer"))
    .filter((footer) => !footer.closest(".cm-sr-codeblock-widget"));
  for (const header of headers) {
    const top = header.getBoundingClientRect().bottom;
    const footer = footers
      .filter((item) => item.getBoundingClientRect().top >= top - 1)
      .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[0] ?? null;
    const bottom = footer?.getBoundingClientRect().bottom ?? top;
    if (event.clientY >= header.getBoundingClientRect().top && event.clientY <= bottom) {
      return { header, footer, bottom };
    }
  }
  return null;
}

function nearestCodeLine(y: number, block: ActiveBlock, view: EditorView): HTMLElement | null {
  const headerBottom = block.header.getBoundingClientRect().bottom;
  const lines = Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-line.cm-sr-codeblock-body"))
    .filter((line) => {
      const box = line.getBoundingClientRect();
      return box.top >= headerBottom - 1 && box.bottom <= block.bottom + 1;
    });
  return lines.sort((left, right) => distanceToCenter(left, y) - distanceToCenter(right, y))[0] ?? null;
}

function distanceToCenter(element: HTMLElement, y: number): number {
  const box = element.getBoundingClientRect();
  return Math.abs(box.top + box.height / 2 - y);
}

function enterInactiveCodeBlock(widget: HTMLElement, view: EditorView): void {
  const from = Number(widget.dataset.srFrom);
  const to = Number(widget.dataset.srTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from + 1) return;
  const caret = Number(widget.dataset.srCaret);
  const anchor = Number.isFinite(caret) && caret >= from && caret <= to ? caret : from + 1;
  view.focus();
  view.dispatch({ selection: { anchor } });
}

function focusCodeLine(event: MouseEvent, line: HTMLElement, view: EditorView): void {
  const box = line.getBoundingClientRect();
  const x = clamp(event.clientX, box.left + 1, Math.max(box.left + 1, box.right - 1));
  const y = clamp(event.clientY, box.top + 1, Math.max(box.top + 1, box.bottom - 1));
  const pos = safePositionAtCoords(view, x, y) ?? safePositionAtDOM(view, line);
  if (pos === null) return;
  view.focus();
  view.dispatch({ selection: { anchor: pos } });
}

function safePositionAtCoords(view: EditorView, x: number, y: number): number | null {
  try {
    return view.posAtCoords({ x, y }, false);
  } catch {
    return null;
  }
}

function safePositionAtDOM(view: EditorView, line: HTMLElement): number | null {
  try {
    return view.posAtDOM(line, 0);
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function consume(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}
