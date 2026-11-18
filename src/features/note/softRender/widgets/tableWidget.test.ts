import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it } from "vitest";
import { softRender } from "../plugin";
import { parseMarkdownTable } from "../utils/table";

async function createView(doc: string, anchor = 0): Promise<EditorView> {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown({ extensions: [GFM] }), softRender({ repoPath: "/repo" })],
  });
  const view = new EditorView({ state, parent: document.body });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return view;
}

beforeEach(() => {
  document.body.innerHTML = "";
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** DOM 行号 = 模型行号 + 1（表头为 0，首数据行为 1）。 */
function cellOf(view: EditorView, domRow: number, col: number): HTMLTableCellElement {
  const el = view.contentDOM.querySelector<HTMLTableCellElement>(`.cm-sr-table-editable [data-sr-row="${domRow}"][data-sr-col="${col}"]`);
  if (!el) throw new Error(`cell ${domRow}/${col} missing`);
  return el;
}

function buttonOf(view: EditorView, label: string): HTMLButtonElement {
  const el = view.contentDOM.querySelector<HTMLButtonElement>(`.cm-sr-table-btn[aria-label="${label}"]`);
  if (!el) throw new Error(`button ${label} missing`);
  return el;
}

async function docAfter(view: EditorView): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return view.state.doc.toString();
}

function editCell(view: EditorView, domRow: number, col: number, text: string): void {
  const cell = cellOf(view, domRow, col);
  cell.textContent = text;
  cell.dispatchEvent(new InputEvent("input", { bubbles: true }));
  cell.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

const TABLE = "| a | b |\n| :--- | ---: |\n| 1 | 2 |";
const INLINE_TABLE = "| 样式 | 代码 |\n| --- | --- |\n| **经典单层** | 一个 `cutout` 槽 |";

describe("softRender 表格可编辑渲染", () => {
  it("渲染为可编辑单元格", async () => {
    const view = await createView(TABLE, 0);
    expect(cellOf(view, 1, 0).contentEditable).toBe("true");
    view.destroy();
  });

  it("点击单元格不把光标移入源码", async () => {
    const view = await createView(TABLE, 0);
    const cell = cellOf(view, 1, 0);
    cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const doc = await docAfter(view);
    expect(view.state.selection.main.head).toBe(0);
    expect(doc).toContain("| a | b |");
    view.destroy();
  });
});

describe("softRender 表格单元格行内渲染", () => {
  it("渲染加粗与行内代码，不显示原始标记", async () => {
    const view = await createView(INLINE_TABLE, 0);
    const bold = cellOf(view, 1, 0);
    const code = cellOf(view, 1, 1);
    expect(bold.querySelector("strong")?.textContent).toBe("经典单层");
    expect(bold.textContent).not.toContain("**");
    expect(code.querySelector("code")?.textContent).toBe("cutout");
    expect(code.textContent).not.toContain("`");
    view.destroy();
  });

  it("保留行内代码中的 Markdown 字面文本并支持嵌套样式", async () => {
    const view = await createView("| a | b |\n| --- | --- |\n| **粗 `code` 尾** | `a **b** c` |", 0);
    expect(cellOf(view, 1, 0).querySelector("strong code")?.textContent).toBe("code");
    expect(cellOf(view, 1, 1).querySelector("strong")).toBeNull();
    expect(cellOf(view, 1, 1).querySelector("code")?.textContent).toBe("a **b** c");
    view.destroy();
  });

  it("聚焦时显示源码，失焦后恢复渲染且不改写 Markdown", async () => {
    const view = await createView(INLINE_TABLE, 0);
    const cell = cellOf(view, 1, 0);
    cell.dispatchEvent(new FocusEvent("focus"));
    expect(cell.textContent).toBe("**经典单层**");
    expect(cell.querySelector("strong")).toBeNull();

    cell.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    expect(cell.querySelector("strong")?.textContent).toBe("经典单层");
    expect(await docAfter(view)).toBe(INLINE_TABLE);
    view.destroy();
  });
});

describe("softRender 表格单元格编辑提交", () => {
  it("编辑数据行并失焦后保持 Markdown 对齐", async () => {
    const view = await createView(TABLE, 0);
    editCell(view, 1, 0, "9");
    const doc = await docAfter(view);
    expect(doc).toContain("| 9 | 2 |");
    expect(doc).toContain("| :--- | ---: |");
    view.destroy();
  });

  it("编辑表头单元格", async () => {
    const view = await createView(TABLE, 0);
    editCell(view, 0, 1, "标题");
    const doc = await docAfter(view);
    expect(doc).toContain("| 标题 |");
    view.destroy();
  });

  it("编辑含转义竖线的值可安全序列化", async () => {
    const view = await createView(TABLE, 0);
    editCell(view, 1, 0, "a|b");
    const doc = await docAfter(view);
    expect(doc).toContain("a\\|b");
    expect(parseMarkdownTable(doc)?.rows[0]?.[0]).toBe("a|b");
    view.destroy();
  });
});

describe("softRender 表格工具栏增行/列", () => {
  it("新增列保持对齐语法", async () => {
    const view = await createView(TABLE, 0);
    cellOf(view, 1, 0).focus();
    buttonOf(view, "右侧插入列").click();
    const doc = await docAfter(view);
    expect(doc).toContain("| :--- | --- | ---: |");
    expect(doc).toContain("a |  | b");
    view.destroy();
  });

  it("新增行追加空行", async () => {
    const view = await createView(TABLE, 0);
    cellOf(view, 1, 0).focus();
    buttonOf(view, "下方插入行").click();
    const doc = await docAfter(view);
    expect(doc).toContain("| 1 | 2 |\n|  |  |");
    view.destroy();
  });
});

describe("softRender 表格工具栏删行/列", () => {
  it("删除行移除对应数据行", async () => {
    const view = await createView("| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |", 0);
    cellOf(view, 1, 0).focus();
    buttonOf(view, "删除行").click();
    const doc = await docAfter(view);
    expect(doc).not.toContain("| 1 | 2 |");
    expect(doc).toContain("| 3 | 4 |");
    view.destroy();
  });

  it("删除列移除对应数据", async () => {
    const view = await createView(TABLE, 0);
    cellOf(view, 1, 0).focus();
    buttonOf(view, "删除列").click();
    const doc = await docAfter(view);
    expect(doc).not.toContain("a");
    expect(doc).not.toContain("1");
    expect(doc).toContain("| b |\n| ---: |\n| 2 |");
    view.destroy();
  });
});

