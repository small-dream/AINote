import { Mark, markInputRule, mergeAttributes } from "@tiptap/core";

/** `#标签` 可视化 mark：文本保留原文（供 Rust 索引提取），视觉高亮为标签样式。 */
export const TagMark = Mark.create({
  name: "tag",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  addAttributes() {
    return { tag: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-tag]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "tag-mark" })];
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
