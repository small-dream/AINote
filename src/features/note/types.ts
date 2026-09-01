import type { NoteContent, NoteMeta, TreeNode } from "@/api/types";
import type { NoteKind } from "@/api/types";

export type { NoteContent, NoteMeta, TreeNode };

/** 新建笔记入参：path 为规范化路径；kind 决定扩展名与默认模板；content 为 null 时由后端写入默认模板 */
export interface NewNoteInput {
  path: string;
  kind: NoteKind;
  content: string | null;
}
