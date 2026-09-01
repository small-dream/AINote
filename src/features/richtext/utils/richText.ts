import type { JSONContent } from "@tiptap/react";

/** 解析 TipTap JSON 内容；非法输入返回空段落文档（防脏数据导致编辑器崩溃） */
export function parseRichTextContent(content: string): JSONContent {
  try {
    const parsed = JSON.parse(content) as JSONContent;
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed;
    }
  } catch {
    /* 非法 JSON 走空文档兜底 */
  }
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** 判断字符串是否为合法富文本 JSON 文档（供写入前防御） */
export function isValidRichText(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as JSONContent;
    return !!parsed && typeof parsed === "object" && parsed.type === "doc";
  } catch {
    return false;
  }
}
