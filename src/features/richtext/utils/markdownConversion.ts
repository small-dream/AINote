import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "./extensions";
import { parseRichTextContent } from "./richText";

/** 把 Markdown 文本转换为 TipTap JSON 字符串（`.md` → `.ainote` 互转用）。
 * tiptap-markdown 在 Markdown 扩展初始化时会把字符串 content 解析为 ProseMirror 文档。 */
export function markdownToRichTextJson(markdown: string): string {
  const editor = new Editor({ extensions: createRichTextExtensions(null), content: markdown });
  const json = editor.getJSON();
  editor.destroy();
  return JSON.stringify(json);
}

/** 把 TipTap JSON 字符串序列化为 Markdown 文本（富文本「导出 Markdown」用）。 */
export function richTextJsonToMarkdown(json: string): string {
  const editor = new Editor({ extensions: createRichTextExtensions(null), content: parseRichTextContent(json) });
  const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
  const markdown = storage.markdown.getMarkdown();
  editor.destroy();
  return markdown;
}
