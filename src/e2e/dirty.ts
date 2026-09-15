/** E2E mock：工作区「待提交变更」记账，模拟真实后端「写入仓库即变脏」的语义。 */

export type E2eChangeStatus = "added" | "modified" | "deleted";

export interface DirtyTrackedStore {
  uncommitted: boolean;
  changedFiles: Array<{ path: string; status: E2eChangeStatus }>;
}

/** 登记一次仓库写入：置位待提交态，并把路径并入变更列表（按路径排序，与 Rust 侧一致）。 */
export function markWorkspaceDirty(store: DirtyTrackedStore, path: string, status: E2eChangeStatus = "modified"): void {
  store.uncommitted = true;
  const others = store.changedFiles.filter((file) => file.path !== path);
  store.changedFiles = [...others, { path, status }].sort((a, b) => a.path.localeCompare(b.path));
}
