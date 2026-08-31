import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

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
