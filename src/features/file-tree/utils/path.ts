/** 文件树路径纯函数 */

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
