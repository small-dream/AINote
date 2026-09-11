import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noteApi } from "@/api";
import type { NoteContent, NoteKind, NoteMeta } from "@/api/types";
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
  kind: NoteKind;
  /** 模板内容；null 表示后端默认模板 */
  content: string | null;
}

interface ImportNoteInput {
  /** 目标目录（仓库相对路径，空串表示仓库根） */
  dir: string;
  fileName: string;
  content: string;
}

/** 新建笔记：成功后刷新列表/树/wiki/同步状态（版本化由用户手动提交或同步前兜底，不再即时提交） */
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, kind, content }: CreateNoteInput) => noteApi.create(path, kind, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      void queryClient.removeQueries({ queryKey: ["note-content"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}

/** 导入 Markdown 文件为笔记（写入当前目录，重名自动加序号）：成功后刷新（P0-2） */
export function useImportNoteMutation() {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: ({ dir, fileName, content }: ImportNoteInput) =>
      noteApi.importFromMarkdown(dir, fileName, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      markActivity();
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}

/** 更新笔记内容（防抖自动保存由 Hook 层调用） */
export function useUpdateNoteMutation(repoPath: string | null = null) {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    meta: { silentError: true },
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      noteApi.update(path, content),
    onSuccess: (_data, { path, content }) => {
      // 自动保存每几秒触发一次：[notes]/[wiki] 都是全仓扫描，只标记过期、不立即重取，
      // 面板下次挂载/聚焦时自然刷新；待提交徽标依赖的 [sync] 仍即时刷新。
      void queryClient.invalidateQueries({ queryKey: ["notes"], refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: ["wiki"], refetchType: "none" });
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
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
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
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
    },
  });
}

/** 转换笔记类型（.md ↔ .ainote），成功后刷新列表/树并让调用方打开新路径（原文件移入回收站，命令侧自动生成一次 `note: convert` 提交） */
export function useConvertNoteMutation() {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn: ({ from, to, content }: { from: string; to: string; content: string }) =>
      noteApi.convert(from, to, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
    },
  });
}

export type { NoteMeta };
