import { Mark, mergeAttributes } from "@tiptap/core";
import { TEXT_STYLE_SPECS, normalizeTextStyle, readTextStyleClass, type TextStyleKind } from "../utils/textStyles";

/** 单个字符样式 mark：属性只有枚举 value，渲染只输出 class。
 * 绝不输出 style 属性（生产壳的 CSP 会拦掉行内属性，见 docs/RICHTEXT_FORMATTING_EVAL.md §4.1）。 */
function createFormatMark(kind: TextStyleKind) {
  const spec = TEXT_STYLE_SPECS[kind];
  const selector = `[class*="${spec.classPrefix}"]`;
  return Mark.create({
    name: spec.markName,
    // priority 决定 mark 的 rank（降序）：必须高于 WikiLink / TagMark 的 1000，才能让自有
    // mark 排在 mark 集合最前。tiptap-markdown 的序列化只看 rank 最大的 mark 决定「是否
    // 转义文本」（prosemirror-markdown 的 `noEsc`），自有 mark 若排在后面，`[[双链]]` 与
    // `#标签` 的原文会被转义成 `\[\[…\]\]`，Markdown 往返与 Rust 侧 wiki 索引都会失配。
    priority: 1100,
    inclusive: true,
    keepOnSplit: true,
    addAttributes() {
      return {
        value: {
          default: null,
          parseHTML: (element: HTMLElement) => readTextStyleClass(kind, element.className),
          renderHTML: (attributes: Record<string, unknown>) => {
            const value = normalizeTextStyle(kind, attributes.value);
            if (!value || value === spec.defaultValue) return {};
            return { class: `${spec.classPrefix}${value}` };
          },
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: selector,
          // 前缀匹配到但没有合法档位时（如 `rt-fg-bogus`）不创建 mark，避免脏 class 进 JSON
          getAttrs: (element: HTMLElement | string) =>
            typeof element === "string" || !readTextStyleClass(kind, element.className) ? false : {},
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return [spec.tag, mergeAttributes(HTMLAttributes)];
    },
    addStorage() {
      // 必须显式声明空序列化：tiptap-markdown 对没有 markdown spec 的 mark 会回退成
      // 「把该 mark 的 HTML 原样写进 Markdown」（HTMLMark 兜底），导出会残留 <span class="rt-fg-*">。
      // 颜色 / 字号 / 字体在 Markdown 侧没有语义，这里声明为无标记输出；高亮将在 M2 换成 `==` 包裹。
      return { markdown: { serialize: { open: "", close: "" } } };
    },
  });
}

export const FontStyleMark = createFormatMark("font");
export const SizeStyleMark = createFormatMark("size");
export const FgStyleMark = createFormatMark("color");
export const MarkStyleMark = createFormatMark("mark");
