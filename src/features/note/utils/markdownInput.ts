export interface ListContinuation {
  /** 续写时插入的换行 + 列表前缀；null 表示当前行不是列表 */
  insert: string | null;
  /** 空列表项回车时是否移除当前行标记 */
  exitList: boolean;
}

const LIST_PATTERN = /^(\s*)([-*+]|(\d+)[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/;

/** 根据当前行文本计算 Enter 后的 Markdown 列表前缀。 */
export function getListContinuation(line: string): ListContinuation {
  const match = LIST_PATTERN.exec(line);
  if (!match) return { insert: null, exitList: false };
  const [, indent, marker, number, spacing, taskPrefix, body] = match;
  if (!body?.trim()) return { insert: "\n", exitList: true };
  const nextMarker = number ? `${Number(number) + 1}.` : marker;
  const task = taskPrefix ? "[ ] " : "";
  return { insert: `\n${indent}${nextMarker}${spacing}${task}`, exitList: false };
}
