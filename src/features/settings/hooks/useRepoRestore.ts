import { useMutation, useQueryClient } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { useSessionStore } from "@/stores/session.store";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { repoKeys } from "./useRepoManager";

/** 从备份恢复：成功后刷新仓库列表并切换到恢复出的仓库。 */
export function useRepoRestore() {
  const queryClient = useQueryClient();
  const switchRepo = useSessionStore((s) => s.switchRepo);

  const mutation = useMutation({
    // 先落盘再切仓：恢复完成后后端已把活动仓库切到恢复结果，之后再保存会写错仓库。
    mutationFn: async () => {
      await flushPendingDrafts();
      return repoApi.restoreBackup();
    },
    onSuccess: (result) => {
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: repoKeys.list });
      switchRepo(result.repoPath);
    },
  });

  return {
    result: mutation.data,
    pending: mutation.isPending,
    failed: mutation.isError,
    error: mutation.error,
    run: mutation.mutate,
  };
}
