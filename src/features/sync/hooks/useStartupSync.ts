import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { isAppError, syncApi } from "@/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/** 启动与联网恢复时自动完成 commit → pull → push，确保离线队列最终送达。 */
export function useStartupSync(repoPath: string | null) {
  const online = useNetworkStatus();
  const queryClient = useQueryClient();
  const startedForRepo = useRef<string | null>(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => syncApi.syncNow(),
    retry: (failureCount, error) => isAppError(error) && error.retriable && failureCount < 3,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
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
