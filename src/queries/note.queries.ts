import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noteApi } from "@/api";
import type { NoteContent, NoteMeta } from "@/api/types";

export const noteKeys = {
  list: (repoPath: string | null) => ["notes", repoPath] as const,
  content: (path: string | null) => ["note-content", path] as const,
};

/** 笔记列表（服务端/Git 状态的唯一权威来源） */
export function useNoteListQuery(repoPath: string | null) {
  return useQuery({
    queryKey: noteKeys.list(repoPath),
    queryFn: () => noteApi.list(),
    enabled: repoPath !== null,
  });
}

/** 单篇笔记完整内容 */
export function useNoteContentQuery(repoPath: string | null, path: string | null) {
  return useQuery({
    queryKey: noteKeys.content(path),
    queryFn: () => noteApi.read(path as string),
    enabled: repoPath !== null && path !== null,
  });
}

/** 新建笔记，成功后打开并刷新列表 */
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => noteApi.create(path),
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      return note;
    },
  });
}

/** 更新笔记内容（防抖自动保存由 Hook 层调用） */
export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      noteApi.update(path, content),
    onSuccess: (_data, { path }) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.setQueryData(noteKeys.content(path), (old: NoteContent | undefined) =>
        old ? { ...old } : old
      );
    },
  });
}

/** 删除笔记，成功后刷新列表与树 */
export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => noteApi.remove(path),
    onSuccess: (_data, path) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.removeQueries({ queryKey: noteKeys.content(path) });
    },
  });
}

/** 移动/重命名笔记 */
export function useMoveNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => noteApi.move(from, to),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
    },
  });
}

export type { NoteMeta };
