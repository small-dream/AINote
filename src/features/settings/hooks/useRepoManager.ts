import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { repoApi } from "@/api";
import type { RepoInfo } from "@/api/types";
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

interface RenameInput {
  id: string;
  name: string;
}

/** 设置页仓库管理编排：列表 + 重命名/移除/切换/新增 */
export function useRepoManager() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const switchRepo = useSessionStore((s) => s.switchRepo);
  const reset = useSessionStore((s) => s.reset);
  const list = useRepoListQuery();

  const rename = useMutation({
    mutationFn: ({ id, name }: RenameInput) => repoApi.rename(id, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: repoKeys.list }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => repoApi.remove(id),
    onSuccess: (newActive) => {
      void queryClient.invalidateQueries({ queryKey: repoKeys.list });
      const current = useSessionStore.getState().repoPath;
      if (newActive === null) {
        reset();
        navigate("/setup", { replace: true });
      } else if (newActive !== current) {
        switchRepo(newActive);
      }
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => repoApi.switchRepo(id),
    onSuccess: (path) => {
      void queryClient.invalidateQueries({ queryKey: repoKeys.list });
      switchRepo(path);
    },
  });

  /** 新增仓库（bind/create 成功后，新仓库已是活动仓库） */
  const handleAdded = (path: string) => {
    void queryClient.invalidateQueries({ queryKey: repoKeys.list });
    switchRepo(path);
  };

  return { repos: list.data ?? [], list, rename, remove, activate, handleAdded };
}

export type { RepoInfo };
