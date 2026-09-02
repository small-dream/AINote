import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "@/features/richtext/utils/extensions";

/**
 * 把 TipTap JSON（`.ainote` 笔记内容）序列化为打印用 HTML。
 * 与富文本编辑器共用扩展集合：图片仓库相对路径按 repoPath 解析为本地资产 URL；
 * 生成后立即销毁临时 Editor，无 DOM/React 依赖（与 markdownToRichTextJson 同模式）。
 */
export function richTextJsonToHtml(json: string, repoPath: string | null): string {
  if (!json.trim()) return "";
  try {
    const editor = new Editor({
      extensions: createRichTextExtensions(repoPath),
      content: JSON.parse(json),
    });
    try {
      return editor.getHTML();
    } finally {
      editor.destroy();
    }
  } catch {
    return "";
  }
}
