import { mergeAttributes } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

/** 基于 highlight.js 的 Lowlight 实例：注册常见语言，支持自动检测。 */
const lowlight = createLowlight(common);

/** 代码块节点：在 Lowlight 语法高亮基础上，把语言写入 pre 的 data-language
 * 属性，供顶部语言徽标展示（替换 StarterKit 内置 codeBlock，同名扩展不能共存）。 */
export const CodeBlock = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }) {
    const language = node.attrs.language ?? null;
    return [
      "pre",
      mergeAttributes(HTMLAttributes, language ? { "data-language": language } : {}),
      ["code", { class: language ? `language-${language}` : null }, 0],
    ];
  },
}).configure({ lowlight });
