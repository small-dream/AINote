import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "./extensions";

/** 把 Markdown 文本转换为 TipTap JSON 字符串（`.md` → `.ainote` 互转用）。
 * tiptap-markdown 在 Markdown 扩展初始化时会把字符串 content 解析为 ProseMirror 文档。 */
export function markdownToRichTextJson(markdown: string): string {
  const editor = new Editor({ extensions: createRichTextExtensions(null), content: markdown });
  const json = editor.getJSON();
  editor.destroy();
  return JSON.stringify(json);
}
