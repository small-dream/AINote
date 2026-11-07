import { EditorView, WidgetType } from "@codemirror/view";
import { mountCodeBlock } from "@/features/code-block/mountCodeBlock";
import { highlightCode } from "../utils/highlight";
import { renderMath } from "../utils/math";
import { renderMermaid } from "../utils/mermaidRender";

// CodeMirror 可复用相等 Widget 的 DOM，但替换 Widget 实例；资源跟随 DOM 而非实例。
const mountedBlocks = new WeakMap<HTMLElement, ReturnType<typeof mountCodeBlock>>();

/** 在 widget 根节点记录源码区间，供点击进入编辑使用。 */
export function markRange(el: HTMLElement, from: number, to: number): void {
  el.dataset.srFrom = String(from);
  el.dataset.srTo = String(to);
}

/** 分割线 */
export class HrWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number) {
    super();
  }

  eq(other: HrWidget): boolean {
    return other instanceof HrWidget && other.from === this.from && other.to === this.to;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-sr-hr";
    markRange(el, this.from, this.to);
    return el;
  }
}

/** 代码块：光标离开时渲染为高亮 DOM。 */
export class CodeBlockWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly language: string,
    readonly from: number,
    readonly to: number,
    readonly caret?: number,
  ) {
    super();
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      other instanceof CodeBlockWidget &&
      other.source === this.source &&
      other.language === this.language &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && Boolean(event.target.closest("[data-code-control]"));
  }

  toDOM(view: EditorView): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "note-code-language";
    footer.textContent = this.language;
    const mounted = mountCodeBlock({
      pre: highlightCode(this.source, this.language || null),
      getSource: () => this.source,
      ...(this.language ? { footer } : {}),
      onLayoutChange: () => view.requestMeasure(),
    });
    const wrapper = mounted.shell;
    mountedBlocks.set(wrapper, mounted);
    wrapper.classList.add("cm-sr-codeblock", "cm-sr-codeblock-widget");
    markRange(wrapper, this.from, this.to);
    if (this.caret !== undefined) wrapper.dataset.srCaret = String(this.caret);
    return wrapper;
  }

  destroy(dom: HTMLElement): void {
    mountedBlocks.get(dom)?.destroy();
    mountedBlocks.delete(dom);
  }
}

/** KaTeX 数学公式 widget。 */
export class MathWidget extends WidgetType {
  constructor(readonly source: string, readonly mode: "inline" | "block", readonly from: number, readonly to: number) {
    super();
  }

  eq(other: MathWidget): boolean {
    return (
      other instanceof MathWidget &&
      other.source === this.source &&
      other.mode === this.mode &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const el = renderMath(this.source, this.mode);
    markRange(el, this.from, this.to);
    return el;
  }
}

/** Mermaid 图表 widget：异步渲染。 */
export class MermaidWidget extends WidgetType {
  constructor(readonly source: string, readonly from: number, readonly to: number) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return (
      other instanceof MermaidWidget &&
      other.source === this.source &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "cm-sr-mermaid";
    container.textContent = this.source;
    markRange(container, this.from, this.to);
    void renderMermaid(container, this.source);
    return container;
  }
}
