import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useResolveConflictMutation, useSyncNowMutation, useSyncStatusQuery } from "@/queries/sync.queries";
import { useCommitPendingMutation } from "@/queries/sync.queries";
import type { SyncStatus } from "@/api/types";
import { deriveSyncLabel } from "../utils/status";
import { useIdleCommit } from "./useIdleCommit";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";

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
  const checkpoint = useCommitPendingMutation();
  const activityVersion = useWorkspaceActivityStore((state) => state.version);

  const status = statusQuery.data ?? DEFAULT_STATUS;
  const label = deriveSyncLabel(status, online);
  const { committing } = useIdleCommit(
    repoPath,
    status.hasUncommitted,
    activityVersion,
    syncNow.isPending || checkpoint.isPending,
  );

  return {
    online,
    status,
    label,
    syncNow,
    resolve,
    checkpoint,
    isSyncing: syncNow.isPending,
    resolving: resolve.isPending,
    committing,
  };
}
