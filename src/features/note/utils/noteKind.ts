import type { NoteKind } from "@/api/types";

/** 笔记类型与扩展名的纯函数映射（Rust 侧 domain/note.rs 与之保持一致） */

export const MARKDOWN_EXT = "md";
export const RICH_TEXT_EXT = "ainote";

/** 按类型返回文件扩展名（不含点） */
export function noteExtension(kind: NoteKind): string {
  return kind === "richText" ? RICH_TEXT_EXT : MARKDOWN_EXT;
}

/** 按路径扩展名判定笔记类型；未知扩展名按 Markdown 处理 */
export function noteKindOfPath(path: string): NoteKind {
  return path.toLowerCase().endsWith(`.${RICH_TEXT_EXT}`) ? "richText" : "markdown";
}

/** 是否为富文本笔记 */
export function isRichTextPath(path: string): boolean {
  return noteKindOfPath(path) === "richText";
}
