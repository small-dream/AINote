import type { ChangeSpec, EditorState, Line } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

/** 格式化操作结果：文档变更 + 可选新选区（省略时由 CodeMirror 自动映射选区） */
export interface FormatResult {
  changes: ChangeSpec;
  selection?: { anchor: number; head?: number };
}

export type InlineFormat = "bold" | "italic" | "strikethrough" | "code";
export type BlockFormat = "quote" | "bullet" | "ordered" | "task";

const INLINE_MARKERS: Record<InlineFormat, string> = {
  bold: "**",
  italic: "*",
  strikethrough: "~~",
  code: "`",
};

const BLOCK_PREFIX: Record<BlockFormat, RegExp> = {
  quote: /^> /,
  bullet: /^- (?!\[)/,
  ordered: /^\d+\. /,
  task: /^- \[[ xX]\] /,
};

/** 行内格式 toggle：已被标记包裹则去除，否则包裹；空选区插入一对标记、光标居中 */
export function toggleInline(state: EditorState, format: InlineFormat): FormatResult {
  const marker = INLINE_MARKERS[format];
  const { from, to } = state.selection.main;
  if (matchOutside(state, marker, from, to)) {
    return {
      changes: [
        { from: from - marker.length, to: from },
        { from: to, to: to + marker.length },
      ],
      selection: { anchor: from - marker.length, head: to - marker.length },
    };
  }
  if (matchInside(state, marker, from, to)) {
    return {
      changes: [
        { from, to: from + marker.length },
        { from: to - marker.length, to },
      ],
      selection: { anchor: from, head: to - marker.length * 2 },
    };
  }
  return {
    changes: [
      { from, insert: marker },
      { from: to, insert: marker },
    ],
    selection: { anchor: from + marker.length, head: to + marker.length },
  };
}

/** 行前缀格式 toggle：选区覆盖行全部已有前缀则批量去除，否则批量添加（有序按行递增） */
export function toggleBlock(state: EditorState, format: BlockFormat): FormatResult {
  const lines = selectedLines(state);
  const re = BLOCK_PREFIX[format];
  const removeAll = lines.every((line) => re.test(line.text));
  const changes: ChangeSpec[] = lines.map((line, index) => {
    if (removeAll) {
      const len = re.exec(line.text)?.[0].length ?? 0;
      return { from: line.from, to: line.from + len };
    }
    return { from: line.from, insert: blockPrefix(format, index) };
  });
  return { changes };
}

/** 设置标题级别：0 = 正文（去除 `#` 前缀），1-3 设置/替换为对应级别 */
export function setHeading(state: EditorState, level: 0 | 1 | 2 | 3): FormatResult {
  const prefix = level === 0 ? "" : `${"#".repeat(level)} `;
  const changes: ChangeSpec[] = [];
  for (const line of selectedLines(state)) {
    const match = /^#{1,6}\s*/.exec(line.text);
    if (match) changes.push({ from: line.from, to: line.from + match[0].length, insert: prefix });
    else if (prefix) changes.push({ from: line.from, insert: prefix });
  }
  return { changes };
}

const NODE_TO_FORMAT: Record<string, string> = {
  StrongEmphasis: "bold",
  Emphasis: "italic",
  Strikethrough: "strikethrough",
  InlineCode: "code",
  Blockquote: "quote",
  ATXHeading1: "h1",
  ATXHeading2: "h2",
  ATXHeading3: "h3",
  Task: "task",
  TaskMarker: "task",
};

/** 光标处的激活格式集合：bold/italic/strikethrough/code/quote/bulletList/orderedList/task/h1-h3 */
export function getActiveFormats(state: EditorState): Set<string> {
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state);
  const active = new Set<string>();
  let node: SyntaxNode | null = tree.resolveInner(state.selection.main.head, 0);
  while (node) {
    const format = NODE_TO_FORMAT[node.name];
    if (format) active.add(format);
    if (node.name === "ListItem") {
      active.add(node.parent?.name === "OrderedList" ? "orderedList" : "bulletList");
    }
    node = node.parent;
  }
  return active;
}

function matchOutside(state: EditorState, marker: string, from: number, to: number): boolean {
  const doc = state.doc.toString();
  if (doc.slice(from - marker.length, from) !== marker) return false;
  if (doc.slice(to, to + marker.length) !== marker) return false;
  // 斜体取最内层匹配：避免把 ** 误判为单个 *
  if (marker === "*") {
    return doc.slice(from - 2, from - 1) !== "*" && doc.slice(to + 1, to + 2) !== "*";
  }
  return true;
}

function matchInside(state: EditorState, marker: string, from: number, to: number): boolean {
  if (from === to) return false;
  const text = state.sliceDoc(from, to);
  return (
    text.length >= marker.length * 2 && text.startsWith(marker) && text.endsWith(marker)
  );
}

function blockPrefix(format: BlockFormat, index: number): string {
  if (format === "quote") return "> ";
  if (format === "bullet") return "- ";
  if (format === "ordered") return `${index + 1}. `;
  return "- [ ] ";
}

function selectedLines(state: EditorState): Line[] {
  const { from, to } = state.selection.main;
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to);
  const lines: Line[] = [];
  for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n));
  return lines;
}
