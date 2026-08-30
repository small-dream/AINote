import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/api";
import type { SyncStatus } from "@/api/types";

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

/** 一键同步：commit → pull → push（P0-4） */
export function useSyncNowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.syncNow(),
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
