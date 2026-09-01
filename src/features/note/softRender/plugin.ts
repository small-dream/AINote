import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap } from "@codemirror/view";
import { assetUrl, openExternal } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";
import type { WidgetRange } from "./types";
import { planSoftRender } from "./utils/plan";
import {
  BulletWidget,
  CheckboxWidget,
  CodeBlockWidget,
  HrWidget,
  ImageWidget,
  MathWidget,
  MermaidWidget,
  NumberWidget,
  TableWidget,
} from "./widgets";

export interface SoftRenderOptions {
  /** 活动仓库绝对路径，用于解析图片等仓库相对路径 */
  repoPath: string | null;
  /** 点击 [[双链]] 时回调目标名 */
  onOpenWiki?: (name: string) => void;
}

/** Markdown 软渲染扩展：源码保持不变，仅用 decoration/widget 覆盖显示（Typora 式 WYSIWYG）。 */
export function softRender(options: SoftRenderOptions): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => computeDecorations(state, options),
    update: (value, tr) => {
      if (!tr.docChanged && !tr.selection) return value;
      return computeDecorations(tr.state, options);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return [
    field,
    keymap.of([{ key: "Space", run: toggleTaskAtCursor }]),
    EditorView.domEventHandlers({ click: (event, view) => handleClick(event, view, options) }),
  ];
}

function computeDecorations(state: EditorState, options: SoftRenderOptions): DecorationSet {
  const doc = state.doc.toString();
  const selection = state.selection.main;
  const cursor = selection.head;
  const selectionTo = selection.empty ? undefined : selection.anchor;
  const tree = ensureSyntaxTree(state, doc.length, 100) ?? syntaxTree(state);
  const plan = planSoftRender(tree, doc, cursor, selectionTo);
  const ranges: Range<Decoration>[] = [
    ...plan.marks.map((mark) =>
      Decoration.mark({ class: mark.cls, ...(mark.attrs ? { attributes: mark.attrs } : {}) }).range(mark.from, mark.to),
    ),
    ...plan.hides.map((hide) =>
      (hide.reveal ? Decoration.mark({ class: "cm-sr-marker" }) : Decoration.replace({})).range(hide.from, hide.to),
    ),
    ...plan.blocks.map((block) => Decoration.mark({ class: block.cls, block: true }).range(block.from, block.to)),
    ...plan.widgets.map((widget) => toWidgetDecoration(widget, options)),
  ];
  return Decoration.set(ranges, true);
}

function toWidgetDecoration(widget: WidgetRange, options: SoftRenderOptions): Range<Decoration> {
  return WIDGET_BUILDERS[widget.kind](widget, options).range(widget.from, widget.to);
}

const WIDGET_BUILDERS: Record<WidgetRange["kind"], (widget: WidgetRange, options: SoftRenderOptions) => Decoration> = {
  checkbox: (widget) => Decoration.replace({ widget: new CheckboxWidget(widget.from, widget.checked ?? false) }),
  image: (widget, options) =>
    Decoration.replace({
      widget: new ImageWidget(resolveImageSrc(options.repoPath, widget.value ?? ""), widget.alt ?? "", widget.from, widget.to),
    }),
  hr: (widget) => Decoration.replace({ widget: new HrWidget(widget.from, widget.to), block: true }),
  table: (widget) => Decoration.replace({ widget: new TableWidget(widget.value ?? "", widget.from, widget.to), block: true }),
  bullet: (widget) => Decoration.replace({ widget: new BulletWidget(widget.from, widget.to) }),
  number: (widget) => Decoration.replace({ widget: new NumberWidget(widget.from, widget.to, widget.index ?? 1) }),
  codeblock: (widget) =>
    Decoration.replace({
      widget: new CodeBlockWidget(widget.value ?? "", widget.alt ?? "", widget.from, widget.to),
      block: true,
    }),
  math: (widget) =>
    Decoration.replace({
      widget: new MathWidget(widget.value ?? "", widget.mode ?? "inline", widget.from, widget.to),
      block: widget.mode === "block",
    }),
  mermaid: (widget) =>
    Decoration.replace({ widget: new MermaidWidget(widget.value ?? "", widget.from, widget.to), block: true }),
};

function handleClick(event: MouseEvent, view: EditorView, options: SoftRenderOptions): boolean {
  const target = event.target;
  const checkbox = getCheckbox(target);
  if (checkbox) {
    event.preventDefault();
    toggleTask(view, checkbox);
    return true;
  }
  if (enterWidgetAt(event, view)) return true;
  // 软渲染可能改变行内元素的实际高度，CodeMirror 仅按鼠标 Y 坐标换算时会把行底部点击误判到下一行。
  // 将单击的 Y 坐标固定到命中行的中心，保留 X 坐标用于计算列位置。
  correctSelectionToClickedLine(event, view);
  if (!isModifierClick(event)) return false;
  const link = closestElement(target, ".cm-sr-link, .cm-sr-wikilink, .cm-sr-autolink");
  if (!link) return false;
  event.preventDefault();
  return openFromLink(link, options);
}

function correctSelectionToClickedLine(event: MouseEvent, view: EditorView): void {
  if (!isPlainSingleClick(event)) return;
  const line = lineElementForTarget(event.target);
  if (!line) return;
  const rect = line.getBoundingClientRect();
  // 多行折行时同一个 .cm-line 包含多个视觉行，不能把点击统一吸附到整块中心。
  if (rect.height <= 0 || rect.height > view.defaultLineHeight * 1.5) return;
  const pos = view.posAtCoords({ x: event.clientX, y: rect.top + rect.height / 2 }, false);
  if (pos === null) return;
  view.dispatch({ selection: { anchor: pos } });
}

function isPlainSingleClick(event: MouseEvent): boolean {
  return event.detail === 1 && !(event.shiftKey || event.altKey || event.ctrlKey || event.metaKey);
}

function lineElementForTarget(target: EventTarget | null): HTMLElement | null {
  return closestElement(target, ".cm-line");
}

function closestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  if (target instanceof HTMLElement) return target.closest<HTMLElement>(selector);
  if (target instanceof Node) return target.parentElement?.closest<HTMLElement>(selector) ?? null;
  return null;
}

/** 点击已渲染 widget（代码块/表格/图片/列表等）时把光标移入其源码区间，进入就地编辑。 */
function enterWidgetAt(event: MouseEvent, view: EditorView): boolean {
  const el = closestElement(event.target, "[data-sr-from]");
  if (!el) return false;
  const from = Number(el.dataset.srFrom);
  const to = Number(el.dataset.srTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from + 1) return false;
  event.preventDefault();
  view.dispatch({ selection: { anchor: from + 1 } });
  return true;
}

function toggleTask(view: EditorView, input: HTMLInputElement): void {
  const from = Number(input.dataset.srFrom);
  if (!Number.isFinite(from)) return;
  toggleTaskRange(view, from, from + 3);
}

/** 空格键在光标所在任务项上切换勾选（键盘可达性）。 */
export function toggleTaskAtCursor(view: EditorView): boolean {
  const task = findTaskMarker(view, view.state.selection.main.head);
  if (!task) return false;
  toggleTaskRange(view, task.from, task.to);
  return true;
}

function findTaskMarker(view: EditorView, cursor: number): SyntaxNode | null {
  const tree = syntaxTree(view.state);
  return findInAncestors(tree.resolveInner(cursor, -1)) ?? findInAncestors(tree.resolveInner(cursor, 1));
}

function findInAncestors(node: SyntaxNode | null): SyntaxNode | null {
  for (; node; node = node.parent) {
    if (node.name === "TaskMarker") return node;
    if (node.name === "FencedCode" || node.name === "InlineCode") return null;
  }
  return null;
}

function toggleTaskRange(view: EditorView, from: number, to: number): void {
  const current = view.state.sliceDoc(from, to);
  const insert = /^\[[xX]\]$/.test(current) ? "[ ]" : "[x]";
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: to } });
}

function getCheckbox(target: EventTarget | null): HTMLInputElement | null {
  return target instanceof HTMLInputElement && target.classList.contains("cm-sr-checkbox") ? target : null;
}

function isModifierClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function openFromLink(link: HTMLElement, options: SoftRenderOptions): boolean {
  const href = link.getAttribute("data-sr-href");
  const wikiTarget = link.getAttribute("data-sr-target");
  if (href) {
    openExternal(href);
    return true;
  }
  if (wikiTarget) {
    options.onOpenWiki?.(wikiTarget);
    return true;
  }
  return false;
}

function resolveImageSrc(repoPath: string | null, src: string): string {
  const local = resolveLocalAssetPath(repoPath ?? "", src);
  if (!local) return src;
  try {
    return assetUrl(local);
  } catch {
    return src;
  }
}
