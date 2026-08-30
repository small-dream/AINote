import type { TreeNode } from "@/api/types";

/** 文件树路径纯函数 */

/** 规范化文件夹路径：去首尾斜杠；空输入返回 null */
export function normalizeFolderPath(input: string): string | null {
  const trimmed = input.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? trimmed : null;
}

/** 递归收集目录树中全部目录路径（不含根节点空串） */
export function collectDirPaths(tree: TreeNode): string[] {
  const dirs: string[] = [];
  if (tree.nodeType === "dir" && tree.path !== "") dirs.push(tree.path);
  for (const child of tree.children) dirs.push(...collectDirPaths(child));
  return dirs;
}

/** 取文件的父目录路径；无目录时返回空字符串 */
export function getDirectoryPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/** 按 "/" 拆分路径段并过滤空段 */
export function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/** 将路径段数组拼接为仓库相对路径 */
export function joinPath(segments: string[]): string {
  return segments.join("/");
}
