import type { ChangeSpec, EditorState, Line } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { SyntaxNode, Tree } from "@lezer/common";

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

/** 行内格式对应的语法节点与标记节点（与工具栏高亮的判定保持一致）。 */
const INLINE_NODES: Record<InlineFormat, { node: string; mark: string }> = {
  bold: { node: "StrongEmphasis", mark: "EmphasisMark" },
  italic: { node: "Emphasis", mark: "EmphasisMark" },
  strikethrough: { node: "Strikethrough", mark: "StrikethroughMark" },
  code: { node: "InlineCode", mark: "CodeMark" },
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
  if (from === to) {
    const enclosing = enclosingFormatRange(state, format);
    if (enclosing) {
      // 光标已在格式内（工具栏此时是高亮态）：按下按钮 = 取消该格式，
      // 避免插入一对空标记（在加粗末尾按加粗会留下 `****` 残渣）。
      // 游标可能停在行尾/后标记上（软渲染下块边界也会归属到该格式），此时
      // `from - marker.length` 会越过删除两个标记后的文本末尾，需按新长度收回。
      const textEnd = enclosing.to - marker.length * 2;
      return {
        changes: [
          { from: enclosing.from, to: enclosing.from + marker.length },
          { from: enclosing.to - marker.length, to: enclosing.to },
        ],
        selection: { anchor: Math.min(Math.max(enclosing.from, from - marker.length), textEnd) },
      };
    }
  }
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

/** 空光标所在的该格式区间：只在标记长度与按钮一致时命中（避免把 `*` 与 `**` 混淆）。 */
function enclosingFormatRange(state: EditorState, format: InlineFormat): { from: number; to: number } | null {
  const { node: nodeName, mark: markName } = INLINE_NODES[format];
  const markerLength = INLINE_MARKERS[format].length;
  const head = state.selection.main.head;
  const tree = ensureSyntaxTree(state, head, 50) ?? syntaxTree(state);
  for (let node: SyntaxNode | null = resolveNodeAt(tree, head); node; node = node.parent) {
    if (node.name !== nodeName) continue;
    const marks = node.getChildren(markName);
    const first = marks[0];
    const last = marks[marks.length - 1];
    if (!first || !last || first === last) continue;
    if (first.to - first.from !== markerLength || last.to - last.from !== markerLength) continue;
    return { from: first.from, to: last.to };
  }
  return null;
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

/** 标题级别：0 = 正文，1-6 与 Markdown ATX 标题（`#` 到 `######`）一一对应 */
export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 设置标题级别：0 = 正文（去除 `#` 前缀），1-6 设置/替换为对应级别 */
export function setHeading(state: EditorState, level: HeadingLevel): FormatResult {
  const prefix = level === 0 ? "" : `${"#".repeat(level)} `;
  const changes: ChangeSpec[] = [];
  const lines = selectedLines(state);
  const { from, to } = state.selection.main;
  const caret = from === to && lines.length === 1 ? from : null;
  let anchor: number | undefined;
  for (const line of lines) {
    const match = /^#{1,6}\s*/.exec(line.text);
    const oldPrefix = match?.[0].length ?? 0;
    if (match) changes.push({ from: line.from, to: line.from + oldPrefix, insert: prefix });
    else if (prefix) changes.push({ from: line.from, insert: prefix });
    // 光标落在旧前缀内部（软渲染下用户很容易点到淡显的 `#`）时，CodeMirror 会把光标
    // 映射到变更起点即行首，而行首不在 ATXHeading 节点里，工具栏于是退回「正文」。
    // 这里显式把光标落到新前缀之后的文字起点，级别回显与「改完继续写」都符合预期。
    if (caret !== null) anchor = line.from + prefix.length + Math.max(caret - line.from - oldPrefix, 0);
  }
  // 没有实际变更（已处于目标级别且光标在文字里）时不改选区，避免多余的 dispatch。
  if (changes.length === 0 || anchor === undefined) return { changes };
  return { changes, selection: { anchor } };
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
  ATXHeading4: "h4",
  ATXHeading5: "h5",
  ATXHeading6: "h6",
  Task: "task",
  TaskMarker: "task",
};

/** 光标处的激活格式集合：bold/italic/strikethrough/code/quote/bulletList/orderedList/task/h1-h6 */
export function getActiveFormats(state: EditorState): Set<string> {
  // 只解析到光标位置：按 doc.length 解析整篇文档会让长笔记里每次移动光标/拖选都卡顿。
  const head = state.selection.main.head;
  const tree = ensureSyntaxTree(state, head, 50) ?? syntaxTree(state);
  const active = new Set<string>();
  let node: SyntaxNode | null = resolveNodeAt(tree, head);
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

/**
 * 光标处的语法节点。`resolveInner(pos, 0)` 在块边界（行首、行尾）会落到文档根节点，
 * 导致工具栏在该位置丢掉全部格式（标题显示成「正文」、列表/引用同理）——而这正是
 * 光标最常见的停留位置。这里按 0 → 后 → 前 依次取第一个非根节点：行尾需要向前归属
 * 上一个块，行首需要向后归属下一个块。
 */
function resolveNodeAt(tree: Tree, pos: number): SyntaxNode {
  const fallback = tree.resolveInner(pos, 0);
  if (fallback.name !== "Document") return fallback;
  for (const side of [1, -1] as const) {
    const node = tree.resolveInner(pos, side);
    if (node.name !== "Document") return node;
  }
  return fallback;
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
