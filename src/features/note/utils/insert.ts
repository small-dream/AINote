import type { EditorState } from "@codemirror/state";
import type { FormatResult } from "./format";

const TABLE_TEMPLATE = "| 列1 | 列2 |\n| --- | --- |\n|  |  |";

/** 链接：有选区包成 [选区](url)，无选区插入 [文字](url)；未提供 url 时选中对应占位符 */
export function insertLink(state: EditorState, url?: string): FormatResult {
  const { from, to, empty } = state.selection.main;
  const text = state.sliceDoc(from, to) || "文字";
  const insert = `[${text}](${url ?? "url"})`;
  const selection = url
    ? { anchor: from + insert.length }
    : linkPlaceholder(from, text, empty);
  return { changes: { from, to, insert }, selection };
}

/** 图片：插入 ![alt]() 并选中 alt */
export function insertImage(state: EditorState): FormatResult {
  const { from, to } = state.selection.main;
  return {
    changes: { from, to, insert: "![alt]()" },
    selection: { anchor: from + 2, head: from + 5 },
  };
}

/** 代码块：无选区插入 ```\n\n``` 光标居中，有选区则包裹 */
export function insertCodeBlock(state: EditorState): FormatResult {
  const { from, to } = state.selection.main;
  const text = state.sliceDoc(from, to);
  const insert = `\`\`\`\n${text}\n\`\`\``;
  return {
    changes: { from, to, insert },
    selection: { anchor: text ? from + insert.length : from + 4 },
  };
}

/** 表格：插入 2 列模板，光标落到第一个数据单元格 */
export function insertTable(state: EditorState): FormatResult {
  const { from, to } = state.selection.main;
  const firstCell = TABLE_TEMPLATE.indexOf("|  |") + 2;
  return {
    changes: { from, to, insert: TABLE_TEMPLATE },
    selection: { anchor: from + firstCell },
  };
}

/** 分割线：当前行下方插入 \n\n---\n */
export function insertDivider(state: EditorState): FormatResult {
  const lineEnd = state.doc.lineAt(state.selection.main.from).to;
  const insert = "\n\n---\n";
  return {
    changes: { from: lineEnd, insert },
    selection: { anchor: lineEnd + insert.length },
  };
}

function linkPlaceholder(from: number, text: string, empty: boolean) {
  // 空选区选中“文字”，有选区选中 url 占位符
  return empty
    ? { anchor: from + 1, head: from + 1 + text.length }
    : { anchor: from + text.length + 3, head: from + text.length + 6 };
}
