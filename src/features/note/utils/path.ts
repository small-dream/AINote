import { splitPath } from "@/features/file-tree/utils/path";
import type { NoteKind } from "@/api/types";
import { noteExtension } from "./noteKind";

/** 笔记路径输入纯函数 */

/** 规范化用户输入的笔记路径：去首尾斜杠；未带扩展名时按类型补后缀；空输入返回 null */
export function normalizeNotePath(input: string, kind: NoteKind): string | null {
  const trimmed = input.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return null;
  return /\.(md|ainote)$/i.test(trimmed) ? trimmed : `${trimmed}.${noteExtension(kind)}`;
}

/** 拼接目录前缀与文件名：目录去斜杠；目录为空时直接返回文件名 */
export function joinNotePath(dir: string, name: string): string {
  const normalizedDir = dir.trim().replace(/^\/+|\/+$/g, "");
  return normalizedDir ? `${normalizedDir}/${name}` : name;
}

/** 取文件名（含扩展名）；无目录时返回原路径 */
export function getNoteFileName(path: string): string {
  // 复用路径段拆分：Windows 历史路径里的 `\` 也能正确取到文件名。
  return splitPath(path).at(-1) ?? path;
}
