import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/api";
import type { SyncStatus } from "@/api/types";
import type { SyncProgress } from "@/api/types";
import { reportSyncProgress, useSyncRetryStore } from "@/stores/sync-retry.store";

/** 同步状态（纯本地查询，启动/切换/操作后自动重取） */
export function useSyncStatusQuery(repoPath: string | null, enabled = true) {
  return useQuery({
    queryKey: ["sync", repoPath],
    queryFn: () => syncApi.status(),
    enabled: repoPath !== null && enabled,
    refetchInterval: (query) => {
      const status = query.state.data;
      if (!status) return false;
      return status.hasUncommitted || status.ahead > 0 ? 15_000 : false;
    },
  });
}

function invalidateSync(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["sync"] });
}

/** 提交工作区全部变更；不执行 Pull/Push。 */
export function useCommitPendingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => syncApi.commit(message),
    onSuccess: () => invalidateSync(queryClient),
  });
}

/**
 * 一键同步：commit → pull → push（P0-4）。
 * 默认把拉取阶段的重试进度写入全局同步态（`useSyncRetryStore`），结算时清空。
 */
export function useSyncNowMutation(options: { onProgress?: (progress: SyncProgress) => void } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.syncNow(options.onProgress ?? reportSyncProgress),
    onSettled: () => useSyncRetryStore.getState().clear(),
    onSuccess: () => {
      invalidateSync(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

/** 解决冲突：保留本地 / 使用远端 */
export function useResolveConflictMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (useLocal: boolean) => syncApi.resolveConflict(useLocal),
    onSuccess: () => {
      invalidateSync(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export type { SyncStatus };

/** 冲突文件列表（P1-3）：仅在处于冲突且面板打开时查询 */
export function useConflictsQuery(repoPath: string | null, enabled = true) {
  return useQuery({
    queryKey: ["conflicts", repoPath],
    queryFn: () => syncApi.conflicts(),
    enabled: repoPath !== null && enabled,
  });
}

/** 按文件解决冲突（P1-3）：写回合并内容，全部解决后由面板触发 push */
export function useResolveFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      syncApi.resolveFile(path, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      invalidateSync(queryClient);
    },
  });
}

/** 推送本地提交（冲突全部解决后收尾，P1-3） */
export function usePushMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.push(),
    onSuccess: () => {
      invalidateSync(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
