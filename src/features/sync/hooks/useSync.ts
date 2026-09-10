import { useCallback } from "react";
import { syncApi } from "@/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSyncRetryStore } from "@/stores/sync-retry.store";
import { useResolveConflictMutation, useSyncNowMutation, useSyncStatusQuery } from "@/queries/sync.queries";
import { useCommitPendingMutation } from "@/queries/sync.queries";
import type { SyncStatus } from "@/api/types";
import { deriveSyncLabel } from "../utils/status";
import { useIdleCommit } from "./useIdleCommit";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";
import { useTranslation } from "@/i18n";

const DEFAULT_STATUS: SyncStatus = {
  ahead: 0,
  behind: 0,
  hasUncommitted: false,
  conflicted: false,
};

/** 同步业务编排：联网状态 + 后端同步状态 + 一键同步/冲突解决 */
export function useSync(repoPath: string | null) {
  const { locale } = useTranslation();
  const online = useNetworkStatus();
  const statusQuery = useSyncStatusQuery(repoPath);
  const retry = useSyncRetryStore((state) => state.progress);
  const syncNow = useSyncNowMutation();
  const resolve = useResolveConflictMutation();
  const checkpoint = useCommitPendingMutation();
  const activityVersion = useWorkspaceActivityStore((state) => state.version);

  const status = statusQuery.data ?? DEFAULT_STATUS;
  const label = deriveSyncLabel(status, online, locale);
  const isSyncing = syncNow.isPending;

  const cancelRetry = useCallback(() => {
    void syncApi.cancelSyncRetry().catch(() => undefined);
  }, []);
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
    isSyncing,
    retry,
    cancelRetry,
    resolving: resolve.isPending,
    committing,
  };
}

/** 同步编排结果：供桌面 / 移动外壳共享同一实例，避免失败态丢失。 */
export type SyncController = ReturnType<typeof useSync>;
