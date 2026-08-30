import { call } from "./client";

export type SyncState = "Synced" | "Syncing" | "Pending" | "Conflict";

/** 同步相关 IPC（P0-4/P0-5），Rust 命令就绪后填充实现 */
export const syncApi = {
  status: (repoPath: string) => call<SyncState>("sync_status", { repoPath }),
  push: (repoPath: string) => call<null>("git_push", { repoPath }),
  pull: (repoPath: string) => call<null>("git_pull", { repoPath }),
};
