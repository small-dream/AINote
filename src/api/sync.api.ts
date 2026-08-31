import { call } from "./client";
import type { ConflictFile, SyncStatus } from "./types";

/** 同步相关 IPC（P0-4 / P0-5 / P0-6） */
export const syncApi = {
  /** 查询同步状态（纯本地，无网络） */
  status: () => call<SyncStatus>("sync_status"),
  /** 一键同步：commit 未提交变更 → pull → push */
  syncNow: () => call<SyncStatus>("sync_now"),
  /** 提交全部未提交变更，返回 commit hash（无可提交时 null） */
  commit: (message: string) => call<string | null>("git_commit", { message }),
  pull: () => call<SyncStatus>("git_pull"),
  push: () => call<SyncStatus>("git_push"),
  /** 解决合并冲突：true 保留本地侧，false 使用远端 */
  resolveConflict: (useLocal: boolean) =>
    call<SyncStatus>("resolve_conflict", { useLocal }),
  /** 列出全部冲突文件（本地/远端内容），供三栏合并（P1-3） */
  conflicts: () => call<ConflictFile[]>("list_conflicts"),
  /** 以指定内容解决单个冲突文件；全部解决后完成 merge commit（P1-3） */
  resolveFile: (path: string, content: string) =>
    call<SyncStatus>("resolve_file_conflict", { path, content }),
};
