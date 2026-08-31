import { useQuery } from "@tanstack/react-query";
import { wikiApi } from "@/api";
import type { NoteWikiDto } from "@/api/types";

/** 标签/双链索引：全仓扫描一次，标签云 / 反链 / 出链目标均由前端纯函数聚合（P1-5） */
export function useWikiIndexQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["wiki", repoPath],
    queryFn: () => wikiApi.index(),
    enabled: repoPath !== null,
  });
}

export type { NoteWikiDto };
