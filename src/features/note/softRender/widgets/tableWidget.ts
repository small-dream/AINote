import { WidgetType, EditorView } from "@codemirror/view";
import { useUiStore } from "@/stores/ui.store";
import { parseMarkdownTable, serializeMarkdownTable, type MarkdownTableData } from "../utils/table";
import { renderTableInline, renderedOffsetAtPoint, sourceOffsetAtRendered } from "./tableInline";

interface TableEditState {
  data: MarkdownTableData;
  source: string;
  from: number;
  to: number;
  activeRow: number;
  activeCol: number;
}

/** 提交重建后要恢复焦点的目标（source 匹配保证定位到同一个表格）。 */
let pendingFocus: { source: string; row: number; col: number } | null = null;

type TableOp = "addRow" | "addCol" | "delRow" | "delCol";

/** 行列增删策略：就地修改编辑模型，保持表头/数据/对齐宽度一致。 */
const OPS: Record<TableOp, (s: TableEditState) => void> = {
  addRow: (s) => { s.activeRow += 1; s.data.rows.splice(s.activeRow, 0, Array.from({ length: s.data.align.length }, () => "")); },
  addCol: (s) => {
    s.activeCol += 1;
    s.data.align.splice(s.activeCol, 0, null);
    s.data.header.splice(s.activeCol, 0, "");
    s.data.rows.forEach((row) => row.splice(s.activeCol, 0, ""));
  },
  delRow: (s) => {
    if (s.data.rows.length <= 1 || s.activeRow < 0) return;
    s.data.rows.splice(s.activeRow, 1);
    s.activeRow = Math.min(s.activeRow, s.data.rows.length - 1);
  },
  delCol: (s) => {
    if (s.data.align.length <= 1) return;
    s.data.align.splice(s.activeCol, 1);
    s.data.header.splice(s.activeCol, 1);
    s.data.rows.forEach((row) => row.splice(s.activeCol, 1));
    s.activeCol = Math.min(s.activeCol, s.data.align.length - 1);
  },
};

/** 可编辑表格 widget：单元格就地编辑（blur/Enter/Tab 提交），增删行列并保持 Markdown 对齐语法。 */
export class TableWidget extends WidgetType {
  private readonly footnotes: Map<string, string>;
  /** eq 比较用：查号表变化（别处新增更早的引用）时必须重建，否则单元格序号陈旧。 */
  private readonly footnoteKey: string;

  constructor(readonly source: string, readonly from: number, readonly to: number, footnotes: Map<string, string>) {
    super();
    this.footnotes = footnotes;
    this.footnoteKey = [...footnotes].map(([label, index]) => `${label}=${index}`).sort().join("&");
  }

  eq(other: TableWidget): boolean {
    return other instanceof TableWidget &&
      other.source === this.source && other.from === this.from && other.to === this.to &&
      other.footnoteKey === this.footnoteKey;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const shell = document.createElement("div");
    shell.className = "cm-sr-table-shell";
    const parsed = parseMarkdownTable(this.source);
    if (!parsed) return fallbackShell(this.source);
    const state: TableEditState = { data: parsed, source: this.source, from: this.from, to: this.to, activeRow: 0, activeCol: 0 };
    shell.dataset.srTableFrom = String(this.from);
    const table = document.createElement("table");
    table.className = "cm-sr-table cm-sr-table-editable";
    table.spellcheck = false;
    buildBody(table, state, shell, this.footnotes);
    shell.append(buildToolbar(state, shell), table);
    const focus = pendingFocus;
    if (focus && focus.source === this.source) {
      pendingFocus = null;
      focusCell(shell, focus.row, focus.col);
    }
    return shell;
  }
}

function fallbackShell(source: string): HTMLElement {
  const fallback = document.createElement("pre");
  fallback.textContent = source;
  const shell = document.createElement("div");
  shell.className = "cm-sr-table-shell";
  shell.appendChild(fallback);
  return shell;
}

function buildBody(table: HTMLTableElement, state: TableEditState, shell: HTMLElement, footnotes: Map<string, string>): void {
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  thead.appendChild(buildRow(state.data.header, -1, state, shell, footnotes));
  state.data.rows.forEach((cells, row) => tbody.appendChild(buildRow(cells, row, state, shell, footnotes)));
  table.append(thead, tbody);
}

function buildRow(cells: string[], modelRow: number, state: TableEditState, shell: HTMLElement, footnotes: Map<string, string>): HTMLTableRowElement {
  const tr = document.createElement("tr");
  cells.forEach((text, col) => {
    const el = document.createElement(modelRow < 0 ? "th" : "td");
    Object.assign(el.dataset, { srCell: "1", srRow: String(modelRow + 1), srCol: String(col) });
    el.contentEditable = "true";
    showRenderedCell(el, text, footnotes);
    if (state.data.align[col]) el.style.textAlign = state.data.align[col] as string;
    const enterSource = (): void => showSourceCell(el, cellText(state, modelRow, col));
    el.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      if (el.dataset.srCellMode === "rendered") rememberCaret(el, event);
      enterSource();
    });
    el.addEventListener("mouseup", () => applyCaretHint(el));
    el.addEventListener("click", (event) => event.stopPropagation());
    el.addEventListener("focus", () => {
      state.activeRow = modelRow;
      state.activeCol = col;
      enterSource();
    });
    el.addEventListener("input", () => {
      if (modelRow < 0) {
        state.data.header[col] = el.textContent ?? "";
      } else {
        const row = state.data.rows[modelRow];
        if (row) row[col] = el.textContent ?? "";
      }
    });
    el.addEventListener("blur", () => {
      commit(state, shell);
      showRenderedCell(el, cellText(state, modelRow, col), footnotes);
    });
    el.addEventListener("keydown", (event) => cellKey(event, state, shell, modelRow, col));
    tr.appendChild(el);
  });
  return tr;
}

function cellText(state: TableEditState, row: number, col: number): string {
  return row < 0 ? (state.data.header[col] ?? "") : (state.data.rows[row]?.[col] ?? "");
}

function showSourceCell(el: HTMLElement, text: string): void {
  if (el.dataset.srCellMode === "source") return;
  el.textContent = text;
  el.dataset.srCellMode = "source";
}

function showRenderedCell(el: HTMLElement, text: string, footnotes: Map<string, string>): void {
  renderTableInline(el, text, footnotes);
  el.dataset.srCellMode = "rendered";
}

/** Remember where the click landed in the rendered text, so switching to source keeps the caret. */
function rememberCaret(el: HTMLElement, event: MouseEvent): void {
  const renderedOffset = renderedOffsetAtPoint(el, event.clientX, event.clientY);
  const sourceOffset = renderedOffset === null ? null : sourceOffsetAtRendered(el, renderedOffset);
  if (sourceOffset === null) {
    delete el.dataset.srCaret;
    return;
  }
  el.dataset.srCaret = String(sourceOffset);
}

/** Restore the click position after the browser placed the caret in the swapped source text. */
function applyCaretHint(el: HTMLElement): void {
  const hint = el.dataset.srCaret;
  if (hint === undefined) return;
  delete el.dataset.srCaret;
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode || !el.contains(selection.anchorNode)) return;
  placeCaret(el, Number(hint));
}

function placeCaret(el: HTMLElement, offset: number): void {
  const first = el.firstChild;
  const node = first && first.nodeType === Node.TEXT_NODE ? first : el;
  const length = node === el ? 0 : (node.textContent?.length ?? 0);
  const range = document.createRange();
  range.setStart(node, Math.max(0, Math.min(offset, length)));
  range.collapse(true);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

function cellKey(event: KeyboardEvent, state: TableEditState, shell: HTMLElement, row: number, col: number): void {
  if (event.key === "Enter") {
    if (event.isComposing) return;
    event.preventDefault();
    const nextRow = Math.min(row + 1, state.data.rows.length - 1);
    commit(state, shell, { row: nextRow, col });
    return;
  }
  if (event.key !== "Tab") return;
  event.preventDefault();
  const width = Math.max(1, state.data.align.length);
  const nextCol = (col + 1) % width;
  commit(state, shell, { row: nextCol === 0 ? row + 1 : row, col: nextCol });
}

function commit(state: TableEditState, shell: HTMLElement, forced?: { row: number; col: number }): void {
  const view = EditorView.findFromDOM(shell);
  if (!view) return;
  const next = serializeMarkdownTable(state.data);
  if (next === state.source) {
    if (forced) focusCell(shell, forced.row, forced.col);
    return;
  }
  const target = forced ?? activeCellIn(shell);
  state.source = next;
  if (target) pendingFocus = { source: next, ...target };
  view.dispatch({ changes: { from: state.from, to: state.to, insert: next } });
}

function activeCellIn(shell: HTMLElement): { row: number; col: number } | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const cell = active.closest?.("[data-sr-cell]");
  if (!cell || !shell.contains(cell)) return null;
  const dataset = (cell as HTMLElement).dataset;
  return { row: Number(dataset.srRow) - 1, col: Number(dataset.srCol) };
}

function focusCell(shell: HTMLElement, row: number, col: number): void {
  const cell = shell.querySelector<HTMLElement>(`[data-sr-row="${row + 1}"][data-sr-col="${col}"]`);
  if (!cell) return;
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  const selection = window.getSelection();
  if (selection) { selection.removeAllRanges(); selection.addRange(range); }
}

function buildToolbar(state: TableEditState, shell: HTMLElement): HTMLDivElement {
  const zh = useUiStore.getState().locale === "zh-CN";
  const t = {
    addRow: zh ? "下方插入行" : "Insert row below", addCol: zh ? "右侧插入列" : "Insert column right",
    delRow: zh ? "删除行" : "Delete row", delCol: zh ? "删除列" : "Delete column",
    delete: zh ? "删除表格" : "Delete table", source: zh ? "编辑源码" : "Edit source",
  };
  const toolbar = document.createElement("div");
  toolbar.className = "cm-sr-table-toolbar";
  const add = (label: string, title: string, run: () => void): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-sr-table-btn";
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopPropagation(); });
    btn.addEventListener("click", (event) => { event.stopPropagation(); run(); });
    return btn;
  };
  toolbar.append(
    add("+", t.addRow, () => mutate(state, shell, "addRow")),
    add("+", t.addCol, () => mutate(state, shell, "addCol")),
    add("-", t.delRow, () => mutate(state, shell, "delRow")),
    add("-", t.delCol, () => mutate(state, shell, "delCol")),
    add("×", t.delete, () => tableAction(state, shell, "delete")),
    add("</>", t.source, () => tableAction(state, shell, "source")),
  );
  return toolbar;
}

function mutate(state: TableEditState, shell: HTMLElement, op: TableOp): void {
  OPS[op](state);
  const view = EditorView.findFromDOM(shell);
  if (!view) return;
  const next = serializeMarkdownTable(state.data);
  const row = Math.min(state.activeRow, Math.max(0, state.data.rows.length - 1));
  const col = Math.min(state.activeCol, Math.max(0, state.data.align.length - 1));
  if (next === state.source) { focusCell(shell, row, col); return; }
  state.source = next;
  pendingFocus = { source: next, row, col };
  view.dispatch({ changes: { from: state.from, to: state.to, insert: next } });
}

function tableAction(state: TableEditState, shell: HTMLElement, mode: "delete" | "source"): void {
  const view = EditorView.findFromDOM(shell);
  if (!view) return;
  view.dispatch(mode === "delete"
    ? { changes: { from: state.from, to: state.to, insert: "" } }
    : { selection: { anchor: Math.min(state.from + 1, state.to) }, effects: EditorView.scrollIntoView(state.from, { y: "center" }) });
  view.focus();
}
