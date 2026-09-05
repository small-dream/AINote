import { useQuery } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { repoKeys } from "./useRepoManager";

/** 当前活动仓库占用大小（服务端/Git 状态权威来源） */
export function useRepoSize() {
  return useQuery({
    queryKey: [...repoKeys.list, "size"] as const,
    queryFn: () => repoApi.size(),
    staleTime: 30_000,
  });
}
