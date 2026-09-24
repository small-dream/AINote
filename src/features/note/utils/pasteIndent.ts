import type { EditorState } from "@codemirror/state";

/**
 * 光标前文本 → 粘贴后续行应补的容器前缀。
 *
 * 列表项内补与内容起点等宽的空格（`- ` → 2 空格、`- [ ] ` → 6 空格），
 * 引用内补 `>` 标记；两者叠加时同时保留（`> - ` → `>   `）。
 * 返回 null 表示不是容器行（普通段落、缩进代码块），不补任何前缀。
 */
export function pasteIndentPrefix(before: string): string | null {
  const quote = /^([ \t]*(?:>[ \t]*)+)/.exec(before);
  const quotePrefix = quote?.[1] ?? "";
  const rest = before.slice(quotePrefix.length);
  const item = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])([ \t]+)(?:\[[ xX]\][ \t]+)?/.exec(rest);
  if (!item) return quotePrefix || null;
  const marker = item[0];
  const indent = item[1] ?? "";
  return quotePrefix + indent + " ".repeat(marker.length - indent.length);
}

/**
 * clipboardInputFilter：多行粘贴时给第二行起的每行补容器前缀。
 *
 * 单行粘贴原样返回（CodeMirror 的 byLine 分支不受影响）；空行不补前缀，
 * 避免在 `.md` 里留下尾随空格。粘贴图片走资产导入管线，不经过此处。
 */
export function indentPastedText(text: string, state: EditorState): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.includes("\n")) return normalized;
  const { head, from } = state.selection.main;
  const prefix = pasteIndentPrefix(state.sliceDoc(state.doc.lineAt(head).from, from));
  if (!prefix) return normalized;
  return normalized
    .split("\n")
    .map((line, index) => (index === 0 || line.trim() === "" ? line : prefix + line))
    .join("\n");
}
