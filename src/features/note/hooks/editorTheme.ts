import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * 适配 AINote 设计 Token 的 CodeMirror 样式表。
 *
 * 所有颜色都引用 CSS 自定义属性，因此当 <html data-theme> 在 light / dark
 * 之间切换时，编辑器外观会随全局主题即时变化，无需重建 EditorView。
 */
const EDITOR_THEME_STYLES = {
  "&": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    padding: "1rem 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  ".cm-selectionBackground, .cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--text-tertiary) 22%, transparent)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--bg-secondary)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-tertiary)",
    borderColor: "var(--border)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-gutterElement": {
    padding: "0 0.75rem",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    boxShadow: "0 8px 24px rgb(15 23 42 / 14%)",
  },
  ".cm-tooltip-arrow::before, .cm-tooltip-arrow::after": {
    borderTopColor: "var(--border)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    borderColor: "var(--border)",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  ".cm-button:hover": {
    backgroundColor: "var(--bg-secondary)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--warning) 55%, transparent)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "2.5rem",
  },
} as const;

/**
 * 生成适配当前明暗模式的 CodeMirror 主题扩展。
 *
 * CodeMirror 需要正确的 `dark` 标志才能正确渲染内部默认高亮、光标等
 * 元素；仅依赖 CSS 变量切换会导致暗色模式下沿用亮色样式。
 */
export function getAinoteEditorTheme(dark: boolean): Extension {
  return EditorView.theme(EDITOR_THEME_STYLES, { dark });
}

/**
 * Markdown 语法高亮：映射到 note 代码层 token，随阅读主题切换。
 *
 * 与 hljs（预览 / 软渲染 / 富文本代码块）消费同一套 `--note-code-*`，
 * 保证源码模式（分栏）下编辑器配色与预览、代码块一致。
 */
export function getAinoteHighlightStyle(): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.comment, color: "var(--note-code-comment)", fontStyle: "italic" },
    { tag: [t.keyword, t.operatorKeyword, t.bool, t.null], color: "var(--note-code-keyword)" },
    { tag: [t.string, t.special(t.string)], color: "var(--note-code-string)" },
    { tag: [t.number, t.atom], color: "var(--note-code-number)" },
    { tag: [t.typeName, t.className, t.namespace], color: "var(--note-code-type)" },
    { tag: [t.function(t.variableName), t.propertyName], color: "var(--note-code-function)" },
    { tag: [t.variableName, t.definition(t.variableName)], color: "var(--note-code-var)" },
    { tag: t.heading, color: "var(--note-ink)", fontWeight: "700" },
    { tag: t.strong, color: "var(--note-ink)", fontWeight: "700" },
    { tag: t.emphasis, color: "var(--note-secondary)", fontStyle: "italic" },
    { tag: t.link, color: "var(--note-accent)", textDecoration: "underline" },
    { tag: t.url, color: "var(--note-tertiary)", textDecoration: "underline" },
    { tag: t.monospace, color: "var(--note-code-string)", fontFamily: "var(--note-code-font)" },
    { tag: t.quote, color: "var(--note-secondary)", fontStyle: "italic" },
    { tag: t.contentSeparator, color: "var(--note-tertiary)" },
    { tag: t.labelName, color: "var(--note-accent)" },
    { tag: t.strikethrough, color: "var(--note-tertiary)", textDecoration: "line-through" },
    { tag: t.meta, color: "var(--note-tertiary)" },
    { tag: t.list, color: "var(--note-accent)" },
  ]);
}
