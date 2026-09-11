import { Mark, markInputRule, mergeAttributes } from "@tiptap/core";
import { registerTagMarkdown } from "../utils/markdownMarks";

/** `#标签` 可视化 mark：文本保留原文（供 Rust 索引提取），视觉高亮为标签样式。
 * markdown-it 解析（存量 Markdown 转换）与序列化（导出/逆转换）规则见 storage.markdown。 */
export const TagMark = Mark.create({
  name: "tag",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-tag"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.tag ? { "data-tag": attributes.tag as string } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-tag]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "tag-mark" })];
  },
  addStorage() {
    return {
      markdown: {
        // 文本本身保留 #原文，open/close 为空且 escape:false，
        // 避免被转义或包上 HTMLMark 的 <span> 噪音。
        serialize: { open: "", close: "", escape: false },
        parse: { setup: registerTagMarkdown },
      },
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(#[^\s#]+)$/,
        type: this.type,
        getAttributes: (match) => ({ tag: (match[1] ?? "").slice(1) }),
      }),
    ];
  },
});
