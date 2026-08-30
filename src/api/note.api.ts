import { call } from "./client";
import type { NoteContent, NoteMeta, TreeNode } from "./types";

/** 笔记 CRUD 与文件树（P0-2 / P0-3）。repoPath 由 Rust 侧 config 读取，无需传参。 */
export const noteApi = {
  list: () => call<NoteMeta[]>("list_notes"),
  read: (path: string) => call<NoteContent>("read_note", { path }),
  /** content 为 null 时由后端写入默认模板 */
  create: (path: string, content: string | null) =>
    call<NoteMeta>("create_note", { path, content }),
  /** 新建文件夹（目录），已存在时幂等 */
  createFolder: (path: string) => call<null>("create_folder", { path }),
  update: (path: string, content: string) => call<null>("update_note", { path, content }),
  remove: (path: string) => call<null>("delete_note", { path }),
  move: (from: string, to: string) => call<null>("move_note", { from, to }),
  tree: () => call<TreeNode>("note_tree"),
};
