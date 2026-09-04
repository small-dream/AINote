const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s+)/;

/** 按 Markdown 行号切换任务项状态；不匹配任务项时返回 null。 */
export function toggleTaskAtLine(markdown: string, line: number, checked: boolean): string | null {
  if (!Number.isInteger(line) || line < 1) return null;
  const segments = markdown.split(/(\r\n|\n|\r)/);
  const index = (line - 1) * 2;
  const current = segments[index];
  if (current === undefined) return null;
  const match = TASK_LINE.exec(current);
  if (!match) return null;
  if (sameTaskState(match[2], checked)) return null;
  segments[index] = `${match[1]}${checked ? "x" : " "}${match[3]}${current.slice(match[0].length)}`;
  return segments.join("");
}

function sameTaskState(value: string | undefined, checked: boolean): boolean {
  return value?.toLocaleLowerCase() === (checked ? "x" : " ");
}
