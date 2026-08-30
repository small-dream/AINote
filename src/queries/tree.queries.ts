import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** 新建文件夹，成功后刷新目录树 */
export function useCreateFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => noteApi.createFolder(path),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
    },
  });
}

/** 删除文件夹及其内容，成功后刷新目录树与笔记列表。 */
export function useDeleteFolderMutation(onDeleted?: (path: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => noteApi.removeFolder(path),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tree"] });
      await queryClient.cancelQueries({ queryKey: ["notes"] });
    },
    onSuccess: (_data, path) => {
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      onDeleted?.(path);
    },
  });
}

export type { TreeNode };
