import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useSessionStore } from "@/stores/session.store";

export const repoKeys = {
  list: ["repos"] as const,
};

/** 已绑定仓库列表（服务端/Git 状态权威来源） */
export function useRepoListQuery() {
  return useQuery({
    queryKey: repoKeys.list,
    queryFn: () => repoApi.list(),
    staleTime: 30_000,
  });
}

/**
 * 切换活动仓库：先落盘编辑器草稿再切换（切换会让工作区整页重挂载），
 * 成功后刷新仓库列表并更新会话路径。
 *
 * 目录树顶部切换器与设置页仓库列表共用这一处实现，保证两条入口语义一致。
 */
export function useSwitchRepoMutation() {
  const queryClient = useQueryClient();
  const switchRepo = useSessionStore((s) => s.switchRepo);

  return useMutation({
    mutationFn: async (id: string) => {
      await flushPendingDrafts();
      return repoApi.switchRepo(id);
    },
    onSuccess: (path) => {
      void queryClient.invalidateQueries({ queryKey: repoKeys.list });
      switchRepo(path);
    },
  });
}
