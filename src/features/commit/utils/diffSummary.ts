import type { DiffLine } from "@/api/types";

export interface DiffSummary {
  added: number;
  removed: number;
}

/** 统计 diff 中新增 / 删除行数，供提交面板显示 +N −N。 */
export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "added") added += 1;
    else if (line.kind === "removed") removed += 1;
  }
  return { added, removed };
}
