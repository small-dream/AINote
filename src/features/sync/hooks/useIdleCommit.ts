import { useEffect } from "react";
import { useCommitPendingMutation } from "@/queries/sync.queries";

/** 工作区持续空闲 15 分钟后，将所有文件变更汇总为一条本地 commit。 */
export const IDLE_COMMIT_DELAY_MS = 15 * 60_000;

export function useIdleCommit(
  repoPath: string | null,
  hasUncommitted: boolean,
  activityVersion: number,
  paused: boolean,
) {
  const commit = useCommitPendingMutation();
  const { mutate, isPending } = commit;

  useEffect(() => {
    if (!repoPath || !hasUncommitted || paused || isPending) return;
    const timer = window.setTimeout(() => {
      mutate("note: auto commit");
    }, IDLE_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activityVersion, hasUncommitted, isPending, mutate, paused, repoPath]);

  return { committing: isPending };
}
