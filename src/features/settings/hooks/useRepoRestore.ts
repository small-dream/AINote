import { useMutation, useQueryClient } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { useSessionStore } from "@/stores/session.store";
import { repoKeys } from "./useRepoManager";

/** 从备份恢复：成功后刷新仓库列表并切换到恢复出的仓库。 */
export function useRepoRestore() {
  const queryClient = useQueryClient();
  const switchRepo = useSessionStore((s) => s.switchRepo);

  const mutation = useMutation({
    mutationFn: () => repoApi.restoreBackup(),
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
