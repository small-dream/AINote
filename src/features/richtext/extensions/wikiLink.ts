import { Mark, markInputRule, mergeAttributes } from "@tiptap/core";
import { parseWikiLink } from "../utils/wikiLink";

/** `[[目标]]` / `[[目标|别名]]` 双链 mark：文本保留方括号原文（供 Rust 索引提取），
 * 视觉高亮并携带 data-wiki-target 供点击跳转。 */
export const WikiLink = Mark.create({
  name: "wikiLink",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  addAttributes() {
    return {
      target: { default: null },
      alias: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-wiki-target]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "wiki-link" })];
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(\[\[[^\]|]+(?:\|[^\]]+)?\]\])$/,
        type: this.type,
        getAttributes: (match) => {
          const raw = (match[1] ?? "").slice(2, -2);
          return parseWikiLink(raw);
        },
      }),
    ];
  },
});
