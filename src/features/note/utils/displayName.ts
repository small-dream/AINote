/** 仅用于界面展示：隐藏笔记文件扩展名，不改变仓库中的真实路径。 */
export function noteDisplayName(value: string): string {
  return value.replace(/\.(?:md|ainote)$/i, "");
}
