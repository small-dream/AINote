import { useState } from "react";
import {
  useFileDiffQuery,
  useRepoHistoryQuery,
  useRestoreFileMutation,
} from "@/queries/history.queries";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import { useSessionStore } from "@/stores/session.store";
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

  async function handleRestore() {
    if (!activeCommit || !activeFile || restore.isPending) return;
    // 恢复直接改写工作区文件：先把未落盘草稿写入磁盘，失败则中止（草稿是仅存副本）
    try {
      await flushPendingDrafts();
    } catch (error) {
      reportToastError(error);
      return;
    }
    restore.mutate(
      { file: activeFile, commitId: activeCommit },
      {
        onSuccess: () => {
          useToastStore.getState().push(t("graph.restored", { file: activeFile }), "success");
          // 恢复的就是当前打开的笔记：驱动编辑器重载（草稿已落盘，重载不会丢输入）
          if (activeFile === useSessionStore.getState().currentNotePath) {
            useNoteReloadStore.getState().requestReload();
          }
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
