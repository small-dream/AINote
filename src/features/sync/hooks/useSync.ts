import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useResolveConflictMutation, useSyncNowMutation, useSyncStatusQuery } from "@/queries/sync.queries";
import type { SyncStatus } from "@/api/types";
import { deriveSyncLabel } from "../utils/status";

const DEFAULT_STATUS: SyncStatus = {
  ahead: 0,
  behind: 0,
  hasUncommitted: false,
  conflicted: false,
};

/** 同步业务编排：联网状态 + 后端同步状态 + 一键同步/冲突解决 */
export function useSync(repoPath: string | null) {
  const online = useNetworkStatus();
  const statusQuery = useSyncStatusQuery(repoPath);
  const syncNow = useSyncNowMutation();
  const resolve = useResolveConflictMutation();

  const status = statusQuery.data ?? DEFAULT_STATUS;
  const label = deriveSyncLabel(status, online);

  return {
    online,
    status,
    label,
    syncNow,
    resolve,
    isSyncing: syncNow.isPending,
    resolving: resolve.isPending,
  };
}
