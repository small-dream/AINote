import type { NoteKind } from "@/api/types";
import { noteExtension } from "./noteKind";

/** 笔记新建模板：内容与默认文件名的纯函数 */

export type NoteTemplate = "default" | "daily" | "blank";

/** 本地时区格式化为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 各模板对应的默认文件名（daily 用日期，其余统一「未命名」，按类型带扩展名） */
export function defaultNoteFileName(kind: NoteKind, template: NoteTemplate, date: Date): string {
  const ext = `.${noteExtension(kind)}`;
  return template === "daily" ? `${formatDate(date)}${ext}` : `未命名${ext}`;
}

/** 富文本 TipTap JSON 文档：heading 为 null 时生成空段落文档 */
export function richTextDoc(heading: string | null): string {
  const content = heading
    ? [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: heading }] },
        { type: "paragraph" },
      ]
    : [{ type: "paragraph" }];
  return JSON.stringify({ type: "doc", content });
}

/** 渲染模板内容；Markdown 的 default 返回 null（由后端写入默认模板），富文本全部前端生成 */
export function renderNoteTemplate(kind: NoteKind, template: NoteTemplate, date: Date): string | null {
  if (kind === "richText") {
    if (template === "daily") return richTextDoc(formatDate(date));
    if (template === "blank") return richTextDoc(null);
    return richTextDoc("未命名");
  }
  if (template === "daily") return `# ${formatDate(date)}\n\n`;
  if (template === "blank") return "";
  return null;
}
