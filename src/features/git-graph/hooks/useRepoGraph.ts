import { useState } from "react";
import {
  useFileDiffQuery,
  useRepoHistoryQuery,
  useRestoreFileMutation,
} from "@/queries/history.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";

/** Repo Git Graph 编排：全仓提交 + 选中提交的文件 + 文件 diff + 恢复（纯派生无副作用）。 */
export function useRepoGraph(repoPath: string | null) {
  const { t } = useTranslation();
  const historyQuery = useRepoHistoryQuery(repoPath);
  const commits = historyQuery.data ?? [];
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const activeCommit =
    selectedCommitId && commits.some((c) => c.id === selectedCommitId)
      ? selectedCommitId
      : (commits[0]?.id ?? null);
  const activeCommitData = commits.find((c) => c.id === activeCommit) ?? null;
  const activeFile =
    activeCommitData && activeCommitData.files.some((f) => f.path === selectedFilePath)
      ? selectedFilePath
      : (activeCommitData?.files[0]?.path ?? null);

  const diffQuery = useFileDiffQuery(repoPath, activeFile, activeCommit);
  const restore = useRestoreFileMutation();

  function handleRestore() {
    if (!activeCommit || !activeFile || restore.isPending) return;
    restore.mutate(
      { file: activeFile, commitId: activeCommit },
      {
        onSuccess: () => {
          useToastStore.getState().push(t("graph.restored", { file: activeFile }), "success");
        },
        onError: reportToastError,
      },
    );
  }

  return {
    commits,
    loading: historyQuery.isLoading,
    activeCommit,
    activeCommitData,
    onSelectCommit: setSelectedCommitId,
    activeFile,
    onSelectFile: setSelectedFilePath,
    diff: diffQuery.data,
    diffLoading: diffQuery.isLoading,
    restoring: restore.isPending,
    restoreError: restore.error,
    handleRestore,
  };
}
