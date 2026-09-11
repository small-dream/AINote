import { Mark, mergeAttributes } from "@tiptap/core";
import { normalizeLinkUrl } from "../utils/linkUrl";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ainoteLink: {
      /** 给选区设置链接（自动校验/规范化 URL；空字符串 = 解除链接；非法返回 false） */
      setLink: (attrs: { href: string }) => ReturnType;
      /** 解除选区链接 */
      unsetLink: () => ReturnType;
    };
  }
}

/**
 * 链接 mark：命名为标准 "link"，tiptap-markdown 按名字自动复用 [text](href) 序列化/解析，
 * 与 Markdown 模式互转链路保持一致。inclusive:false 保证行尾继续输入不会误带链接。
 */
export const AinoteLink = Mark.create({
  name: "link",
  inclusive: false,
  keepOnSplit: false,

  addAttributes() {
    return { href: { default: null } };
  },

  parseHTML() {
    return [{ tag: "a[href]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { class: "link-mark", rel: "noopener noreferrer" }), 0];
  },

  addCommands() {
    return {
      setLink:
        (attrs) =>
        ({ chain }) => {
          const normalized = normalizeLinkUrl(attrs.href);
          if (!normalized) {
            if (!attrs.href.trim()) return chain().focus().unsetLink().run();
            return false;
          }
          return chain().focus().extendMarkRange(this.name).setMark(this.name, { href: normalized }).run();
        },
      unsetLink:
        () =>
        ({ chain }) =>
          chain().focus().extendMarkRange(this.name).unsetMark(this.name).run(),
    };
  },
});
