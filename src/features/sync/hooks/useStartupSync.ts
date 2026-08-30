import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { syncApi } from "@/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/** P0-5 启动时自动检查远端：挂载后静默 pull，无论成败都刷新同步/笔记状态 */
export function useStartupSync(repoPath: string | null) {
  const online = useNetworkStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!repoPath || !online) return;
    let cancelled = false;
    void syncApi
      .pull()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ["sync"] });
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
        void queryClient.invalidateQueries({ queryKey: ["tree"] });
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, online, queryClient]);
}
