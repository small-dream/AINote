import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { wikiApi } from "@/api";
import type { NoteWikiDto, UnlinkedMentionRef } from "@/api/types";

/** 标签/双链索引：全仓扫描一次，标签云 / 反链 / 出链目标均由前端纯函数聚合（P1-5） */
export function useWikiIndexQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["wiki", repoPath],
    queryFn: () => wikiApi.index(),
    enabled: repoPath !== null,
  });
}

export const mentionKeys = {
  list: (repoPath: string | null, path: string | null) => ["wiki-mentions", repoPath, path] as const,
};

/** 未链接提及只在双链面板打开时按需扫描，不进入全量 wiki_index。 */
export function useUnlinkedMentionsQuery(repoPath: string | null, path: string | null, enabled: boolean) {
  return useQuery({
    queryKey: mentionKeys.list(repoPath, path),
    queryFn: () => wikiApi.unlinkedMentions(path as string),
    enabled: enabled && repoPath !== null && path !== null,
  });
}

/** 转换后刷新笔记、目录、双链索引与未链接提及。 */
export function useConvertMentionsMutation(repoPath: string | null, targetPath: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mentions: UnlinkedMentionRef[]) => wikiApi.convertMentions(targetPath as string, mentions),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["tree"] }),
        queryClient.invalidateQueries({ queryKey: ["wiki"] }),
        queryClient.invalidateQueries({ queryKey: ["note-content"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: mentionKeys.list(repoPath, targetPath) }),
      ]);
    },
  });
}

export type { NoteWikiDto };
