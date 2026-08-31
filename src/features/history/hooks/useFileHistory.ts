import { useState } from "react";
import { useFileDiffQuery, useFileHistoryQuery, useRestoreFileMutation } from "@/queries/history.queries";

interface UseFileHistoryOptions {
  repoPath: string | null;
  path: string | null;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

/** 历史面板编排：提交列表 + 选中提交 diff + 恢复（默认选中最新，纯派生无副作用） */
export function useFileHistory({ repoPath, path, open, onClose, onRestored }: UseFileHistoryOptions) {
  const historyQuery = useFileHistoryQuery(repoPath, path, open);
  const commits = historyQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId =
    selectedId && commits.some((c) => c.id === selectedId)
      ? selectedId
      : (commits[0]?.id ?? null);
  const diffQuery = useFileDiffQuery(repoPath, path, activeId);
  const restore = useRestoreFileMutation();

  function handleRestore() {
    if (!activeId || !path || restore.isPending) return;
    restore.mutate(
      { file: path, commitId: activeId },
      {
        onSuccess: () => {
          onRestored();
          onClose();
        },
      },
    );
  }

  return {
    commits,
    selectedId: activeId,
    onSelect: setSelectedId,
    diff: diffQuery.data,
    diffLoading: diffQuery.isLoading,
    restoring: restore.isPending,
    restoreError: restore.error,
    handleRestore,
  };
}
