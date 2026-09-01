import { WidgetType } from "@codemirror/view";
import { parseMarkdownTable } from "../utils/table";
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

/** 表格：解析 Markdown 表格源码渲染为真实表格 */
export class TableWidget extends WidgetType {
  constructor(readonly source: string, readonly from: number, readonly to: number) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      other instanceof TableWidget &&
      other.source === this.source &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(): HTMLElement {
    const table = document.createElement("table");
    table.className = "cm-sr-table";
    markRange(table, this.from, this.to);
    const parsed = parseMarkdownTable(this.source);
    if (!parsed) {
      table.textContent = this.source;
      return table;
    }
    table.appendChild(buildSection("thead", "th", parsed.header, parsed.align));
    const tbody = document.createElement("tbody");
    for (const row of parsed.rows) tbody.appendChild(buildRow(row, "td", parsed.align));
    table.appendChild(tbody);
    return table;
  }
}

function buildSection(
  tag: "thead" | "tbody",
  cellTag: "th" | "td",
  cells: string[],
  align: ("left" | "center" | "right" | null)[],
): HTMLElement {
  const section = document.createElement(tag);
  section.appendChild(buildRow(cells, cellTag, align));
  return section;
}

function buildRow(
  cells: string[],
  cellTag: "th" | "td",
  align: ("left" | "center" | "right" | null)[],
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  cells.forEach((cell, index) => {
    const el = document.createElement(cellTag);
    el.textContent = cell;
    const a = align[index];
    if (a) el.style.textAlign = a;
    tr.appendChild(el);
  });
  return tr;
}

/** 代码块：光标离开时渲染为高亮 DOM。 */
export class CodeBlockWidget extends WidgetType {
  constructor(readonly source: string, readonly language: string, readonly from: number, readonly to: number) {
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

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-sr-codeblock cm-sr-codeblock-widget";
    const header = document.createElement("div");
    header.className = "cm-sr-codeblock-header";
    header.textContent = this.language || "code";
    wrapper.appendChild(header);
    wrapper.appendChild(highlightCode(this.source, this.language || null));
    markRange(wrapper, this.from, this.to);
    return wrapper;
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
