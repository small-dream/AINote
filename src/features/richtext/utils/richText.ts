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

/** 将首个一级标题同步为输入标题；文档缺标题时插入一级标题。 */
export function applyRichTextTitle(content: string, title: string): string {
  let parsed: JSONContent;
  try {
    parsed = JSON.parse(content) as JSONContent;
  } catch {
    parsed = { type: "doc", content: [{ type: "paragraph" }] };
  }
  if (parsed.type !== "doc") parsed = { type: "doc", content: [parsed] };
  parsed.content ??= [];
  const heading = parsed.content.find((node) => node?.type === "heading" && node.attrs?.level === 1);
  if (heading) {
    heading.content = title ? [{ type: "text", text: title }] : [];
    return JSON.stringify(parsed);
  }
  if (!title) return JSON.stringify(parsed);
  parsed.content.unshift({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title }] });
  return JSON.stringify(parsed);
}
