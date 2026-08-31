import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noteApi, syncApi } from "@/api";
import type { NoteContent, NoteMeta } from "@/api/types";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";

export const noteKeys = {
  list: (repoPath: string | null) => ["notes", repoPath] as const,
  content: (repoPath: string | null, path: string | null) => ["note-content", repoPath, path] as const,
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
    queryKey: noteKeys.content(repoPath, path),
    queryFn: () => noteApi.read(path as string),
    enabled: repoPath !== null && path !== null,
  });
}

interface CreateNoteInput {
  path: string;
  /** 模板内容；null 表示后端默认模板 */
  content: string | null;
}

/** 新建笔记：成功即本地 commit 版本化，并刷新列表/树/同步状态（P0-2） */
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, content }: CreateNoteInput) => noteApi.create(path, content),
    onSuccess: (_note, { path }) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.removeQueries({ queryKey: ["note-content"] });
      void syncApi.commit(`note: create ${path}`).finally(() => {
        void queryClient.invalidateQueries({ queryKey: ["sync"] });
      });
    },
  });
}

/** 更新笔记内容（防抖自动保存由 Hook 层调用） */
export function useUpdateNoteMutation(repoPath: string | null = null) {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      noteApi.update(path, content),
    onSuccess: (_data, { path, content }) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
      void queryClient.setQueryData(noteKeys.content(repoPath, path), (old: NoteContent | undefined) =>
        old ? { ...old, content } : { path, content }
      );
    },
  });
}

/** 删除笔记，成功后刷新列表与树 */
export function useDeleteNoteMutation(onDeleted?: (path: string) => void) {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: (path: string) => noteApi.remove(path),
    onMutate: async (path) => {
      await queryClient.cancelQueries({ queryKey: ["tree"] });
      await queryClient.cancelQueries({ queryKey: ["notes"] });
      return { path };
    },
    onSuccess: (_data, path) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
      void queryClient.removeQueries({ queryKey: ["note-content"] });
      onDeleted?.(path);
    },
  });
}

/** 移动/重命名笔记 */
export function useMoveNoteMutation() {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => noteApi.move(from, to),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
    },
  });
}

export type { NoteMeta };
