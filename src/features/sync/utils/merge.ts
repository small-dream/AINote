/** 把文本按行拆分，供三栏合并行级挑选（P1-3） */
export function splitLines(content: string): string[] {
  return content.split("\n");
}

/** 追加一行到合并文本（空文本时直接作为首行） */
export function appendLine(merged: string, line: string): string {
  if (line.length === 0) return merged;
  return merged.length === 0 ? line : `${merged}\n${line}`;
}
