import type { ChangedFile } from "@/api/types";

/** 勾选集合切换（不可变）：命中即移除，否则加入。 */
export function toggleSelection(selected: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(selected);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

/** 全选 / 取消全选：已全选则清空，否则选中全部给定路径。 */
export function toggleSelectAll(selected: ReadonlySet<string>, paths: readonly string[]): Set<string> {
  const allSelected = paths.length > 0 && paths.every((path) => selected.has(path));
  return allSelected ? new Set() : new Set(paths);
}

/**
 * 按状态拆分选中项：`added`（新增）没有历史版本，丢弃只能彻底删除；
 * `modified` / `deleted`（改 / 删）恢复到上次提交版本。确认文案据此分列。
 */
export function splitByStatus(files: readonly ChangedFile[]): {
  restore: ChangedFile[];
  remove: ChangedFile[];
} {
  return {
    restore: files.filter((file) => file.status !== "added"),
    remove: files.filter((file) => file.status === "added"),
  };
}
