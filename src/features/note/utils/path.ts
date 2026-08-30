/** 笔记路径输入纯函数 */

/** 规范化用户输入的笔记路径：去首尾斜杠、补 .md 后缀；空输入返回 null */
export function normalizeNotePath(input: string): string | null {
  const trimmed = input.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return null;
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}
