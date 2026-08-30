import { useQuery } from "@tanstack/react-query";
import { noteApi } from "@/api";

/** 笔记列表（服务端/Git 状态的唯一权威来源） */
export function useNoteListQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["notes", repoPath],
    queryFn: () => noteApi.list(repoPath as string),
    enabled: repoPath !== null,
  });
}
