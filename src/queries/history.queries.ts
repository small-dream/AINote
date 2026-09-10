import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { historyApi } from "@/api";
import type { CommitInfo, FileDiff } from "@/api/types";

/** 历史查询键：repo + 文件路径 */
export const historyKeys = {
  all: (repoPath: string | null, path: string | null) => ["history", repoPath, path] as const,
  repo: (repoPath: string | null) => ["repo-history", repoPath] as const,
  diff: (repoPath: string | null, path: string | null, commitId: string | null) =>
    ["history-diff", repoPath, path, commitId] as const,
};

/** 指定文件的提交历史（P1-1） */
export function useFileHistoryQuery(repoPath: string | null, path: string | null, enabled = true) {
  return useQuery({
    queryKey: historyKeys.all(repoPath, path),
    queryFn: () => historyApi.history(path as string),
    enabled: repoPath !== null && path !== null && enabled,
  });
}

/** 全仓提交历史（Repo Git Graph），含每 commit 直接改动的文件 */
export function useRepoHistoryQuery(repoPath: string | null, enabled = true) {
  return useQuery({
    queryKey: historyKeys.repo(repoPath),
    queryFn: () => historyApi.repoHistory(200),
    enabled: repoPath !== null && enabled,
  });
}

/** 选中提交相对其父提交的单文件 diff */
export function useFileDiffQuery(
  repoPath: string | null,
  path: string | null,
  commitId: string | null,
) {
  return useQuery({
    queryKey: historyKeys.diff(repoPath, path, commitId),
    queryFn: () => historyApi.diff(path as string, commitId as string),
    enabled: repoPath !== null && path !== null && commitId !== null,
  });
}

/** 恢复文件到指定版本：写工作区 → 立即提交 → 刷新列表/树/同步，并让编辑器重载 */
export function useRestoreFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, commitId }: { file: string; commitId: string }) =>
      historyApi.restore(file, commitId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["note-content"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}

export type { CommitInfo, FileDiff };
