import { WidgetType } from "@codemirror/view";
import { highlightCode } from "../utils/highlight";
import { renderMath } from "../utils/math";
import { renderMermaid } from "../utils/mermaidRender";

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
  constructor(readonly source: string, readonly language: string, readonly from: number, readonly to: number, readonly copyCodeLabel = "Copy code", readonly copiedLabel = "Copied") {
    super();
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      other instanceof CodeBlockWidget &&
      other.source === this.source &&
      other.language === this.language &&
      other.from === this.from &&
      other.to === this.to &&
      other.copyCodeLabel === this.copyCodeLabel &&
      other.copiedLabel === this.copiedLabel
    );
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-sr-codeblock cm-sr-codeblock-widget";
    const header = document.createElement("div");
    header.className = "cm-sr-codeblock-header";
    const language = document.createElement("span");
    language.textContent = this.language || "code";
    header.appendChild(language);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "cm-sr-code-copy";
    copy.textContent = this.copyCodeLabel;
    copy.dataset.label = this.copyCodeLabel;
    copy.setAttribute("aria-label", this.copyCodeLabel);
    copy.addEventListener("click", () => {
      void copyCode(this.source, copy, this.copiedLabel);
    });
    header.appendChild(copy);
    wrapper.appendChild(header);
    wrapper.appendChild(highlightCode(this.source, this.language || null));
    markRange(wrapper, this.from, this.to);
    return wrapper;
  }
}

async function copyCode(source: string, button: HTMLButtonElement, copiedLabel: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(source);
    button.textContent = copiedLabel;
    button.setAttribute("aria-label", copiedLabel);
    window.setTimeout(() => {
      button.textContent = button.dataset.label ?? "Copy code";
      button.setAttribute("aria-label", button.textContent);
    }, 1400);
  } catch {
    return;
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
