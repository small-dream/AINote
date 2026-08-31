import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trashApi } from "@/api";

/** 回收站列表（P2）：仅面板打开时查询 */
export function useTrashListQuery(repoPath: string | null, enabled = true) {
  return useQuery({
    queryKey: ["trash", repoPath],
    queryFn: () => trashApi.list(),
    enabled: repoPath !== null && enabled,
  });
}

/** 恢复回收站条目：成功后刷新回收站/树/笔记/同步状态 */
export function useTrashRestoreMutation(onRestored?: (path: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: (path) => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      onRestored?.(path);
    },
  });
}

/** 彻底删除单个回收站条目 */
export function useTrashDeleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trashApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}

/** 清空回收站 */
export function useTrashEmptyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trashApi.empty(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}
