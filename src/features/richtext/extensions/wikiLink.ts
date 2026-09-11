import { Mark, markInputRule, mergeAttributes } from "@tiptap/core";
import { parseWikiLink } from "../utils/wikiLink";
import { registerWikiLinkMarkdown } from "../utils/markdownMarks";

/** `[[目标]]` / `[[目标|别名]]` 双链 mark：文本保留方括号原文（供 Rust 索引提取），
 * 视觉高亮并携带 data-wiki-target 供点击跳转。
 * markdown-it 解析（存量 Markdown 转换）与序列化（导出/逆转换）规则见 storage.markdown。 */
export const WikiLink = Mark.create({
  name: "wikiLink",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-wiki-target"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.target ? { "data-wiki-target": attributes.target as string } : {},
      },
      alias: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-wiki-alias"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.alias ? { "data-wiki-alias": attributes.alias as string } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-wiki-target]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "wiki-link" })];
  },
  addStorage() {
    return {
      markdown: {
        // 文本本身保留 [[原文]]，open/close 为空且 escape:false（等同行内代码的序列化路径），
        // 避免被转义成 \[\[ 或包上 HTMLMark 的 <span> 噪音。
        serialize: { open: "", close: "", escape: false },
        parse: { setup: registerWikiLinkMarkdown },
      },
    };
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
