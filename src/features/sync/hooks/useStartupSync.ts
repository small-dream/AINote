import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { syncApi } from "@/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSyncRetryStore } from "@/stores/sync-retry.store";

/**
 * 启动与联网恢复时只拉取远端更新。
 *
 * 启动阶段不提交本地改动、也不推送本地提交：未提交内容由用户决定何时保存版本，
 * 完整的 commit → pull → push 仅由手动「一键同步」触发。
 */
export function useStartupSync(repoPath: string | null) {
  const online = useNetworkStatus();
  const queryClient = useQueryClient();
  const startedForRepo = useRef<string | null>(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => syncApi.pull(),
    // 网络重试由 Rust 拉取用例负责；启动不触发提交或推送。
    retry: false,
    onSettled: () => {
      useSyncRetryStore.getState().clear();
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      // 启动同步的 pull 可能带回落盘内的 todos.json，待办看板需要主动重取。
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  useEffect(() => {
    if (!repoPath || !online) {
      startedForRepo.current = null;
      return;
    }
    if (startedForRepo.current === repoPath || isPending) return;
    startedForRepo.current = repoPath;
    mutate();
  }, [repoPath, online, isPending, mutate]);

  return isPending;
}
