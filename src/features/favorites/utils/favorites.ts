import type { NoteMeta } from "@/api/types";

/** 把收藏元数据转为路径集合，供目录树判断当前收藏状态。 */
export function favoritePathsOf(notes: NoteMeta[]): Set<string> {
  return new Set(notes.map((note) => note.path));
}

/** 展示名：优先笔记标题，空标题回退文件名。 */
export function favoriteDisplayName(note: NoteMeta): string {
  return note.title || note.path.split("/").pop() || note.path;
}
