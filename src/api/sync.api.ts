import { Channel } from "@tauri-apps/api/core";
import { call } from "./client";
import type { ConflictExportDto, ConflictFile, SyncProgress, SyncStatus } from "./types";

/** 同步相关 IPC（P0-4 / P0-5 / P0-6） */
export const syncApi = {
  /** 查询同步状态（纯本地，无网络） */
  status: () => call<SyncStatus>("sync_status"),
  /** 一键同步：commit 未提交变更 → pull → push；onProgress 接收拉取阶段的重试进度 */
  syncNow: (onProgress?: (progress: SyncProgress) => void) => {
    const channel = new Channel<SyncProgress>();
    if (onProgress) channel.onmessage = onProgress;
    return call<SyncStatus>("sync_now", { onEvent: channel });
  },
  /** 取消进行中的同步自动重试（只结束退避等待，不中断已发出的请求） */
  cancelSyncRetry: () => call<null>("cancel_sync_retry"),
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
  /** 导出冲突文件两侧内容兜底；用户取消保存时返回 null（E3-T5） */
  exportConflicts: () => call<ConflictExportDto | null>("export_conflicts"),
};
