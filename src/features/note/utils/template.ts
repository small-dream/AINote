/** 笔记新建模板：内容与默认文件名的纯函数 */

export type NoteTemplate = "default" | "daily" | "blank";

/** 本地时区格式化为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 各模板对应的默认文件名（daily 用日期，其余统一「未命名」） */
export function defaultNoteFileName(template: NoteTemplate, date: Date): string {
  return template === "daily" ? `${formatDate(date)}.md` : "未命名.md";
}

/** 渲染模板内容；default 返回 null，表示由后端写入默认模板 */
export function renderNoteTemplate(template: NoteTemplate, date: Date): string | null {
  if (template === "daily") return `# ${formatDate(date)}\n\n`;
  if (template === "blank") return "";
  return null;
}
