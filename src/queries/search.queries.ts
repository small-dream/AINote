import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/api";

/** 搜索查询键：repo + 查询词（Rust 侧排序，标题命中优先） */
export const searchKeys = {
  all: (repoPath: string | null, query: string) => ["search", repoPath, query] as const,
};

/** 全文搜索（P1-2）：输入为空时禁用，避免无效 IPC */
export function useSearchQuery(repoPath: string | null, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: searchKeys.all(repoPath, trimmed),
    queryFn: () => searchApi.search(trimmed),
    enabled: repoPath !== null && trimmed.length > 0,
  });
}
