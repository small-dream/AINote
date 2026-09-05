import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoriteApi, syncApi } from "@/api";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";
import { reportToastError } from "@/stores/toast.store";

/** 收藏笔记列表（P1-13，服务端/Git 状态权威来源） */
export function useFavoriteNotesQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["favorites", repoPath],
    queryFn: favoriteApi.list,
    enabled: repoPath !== null,
  });
}

/** 切换收藏：成功后刷新索引，并把收藏索引纳入版本化提交。 */
export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: favoriteApi.toggle,
    onSuccess: (isFavorite, path) => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      markActivity();
      void syncApi
        .commit(`note: ${isFavorite ? "favorite" : "unfavorite"} ${path}`)
        .catch(reportToastError)
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: ["sync"] });
        });
    },
  });
}
