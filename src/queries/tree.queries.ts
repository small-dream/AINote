import { useQuery } from "@tanstack/react-query";
import { noteApi } from "@/api";
import type { TreeNode } from "@/api/types";

/** 笔记文件树（P0-3，服务端/Git 状态权威来源） */
export function useNoteTreeQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["tree", repoPath],
    queryFn: () => noteApi.tree(),
    enabled: repoPath !== null,
  });
}

export type { TreeNode };
