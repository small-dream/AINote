import { create } from "zustand";
import type { SyncProgress } from "@/api/types";

/** 拉取阶段自动重试的进度（「重试中（n/m）」+ 取消入口） */
export interface SyncRetryProgress {
  retry: number;
  maxRetries: number;
  delayMs: number;
}

interface SyncRetryState {
  progress: SyncRetryProgress | null;
  report: (progress: SyncRetryProgress) => void;
  clear: () => void;
}

/**
 * 自动重试进度的全局来源：手动同步、启动同步、命令面板共用，
 * 避免每个 mutation 实例各拿一份进度导致横幅看不到重试。
 */
export const useSyncRetryStore = create<SyncRetryState>((set) => ({
  progress: null,
  report: (progress) => set({ progress }),
  clear: () => set({ progress: null }),
}));

/** IPC 进度事件 → 全局重试态（供各同步入口统一复用） */
export function reportSyncProgress(progress: SyncProgress): void {
  useSyncRetryStore.getState().report({
    retry: progress.retry,
    maxRetries: progress.maxRetries,
    delayMs: progress.delayMs,
  });
}
