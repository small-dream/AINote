import { useQuery } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { repoKeys } from "@/queries/repo.queries";
import { useSessionStore } from "@/stores/session.store";

/** 当前活动仓库占用大小（服务端/Git 状态权威来源）；键带 repoPath，切仓即换缓存条目 */
export function useRepoSize() {
  const repoPath = useSessionStore((state) => state.repoPath);
  return useQuery({
    queryKey: [...repoKeys.list, "size", repoPath] as const,
    queryFn: () => repoApi.size(),
    staleTime: 30_000,
  });
}
