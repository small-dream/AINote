import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { syncApi } from "@/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/** P0-5 启动时自动检查远端：挂载后静默 pull，无论成败都刷新同步/笔记状态 */
export function useStartupSync(repoPath: string | null) {
  const online = useNetworkStatus();
  const queryClient = useQueryClient();
  const startedForRepo = useRef<string | null>(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => syncApi.pull(),
    retry: false,
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
