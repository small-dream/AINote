import type { QueryClient } from "@tanstack/react-query";
import { hasPendingDraft } from "@/features/note/utils/draftRegistry";
import { useNoteReloadStore } from "@/stores/note-reload.store";

/**
 * 工作区被 Git 操作整体改写（同步 commit→pull→push / 冲突解决）后的统一失效面：
 * 任何面板/查询下次读取时都拿到磁盘上的新状态，不留陈旧缓存。
 */
export function invalidateWorkspaceQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["sync"] });
  void queryClient.invalidateQueries({ queryKey: ["notes"] });
  void queryClient.invalidateQueries({ queryKey: ["note-content"] });
  void queryClient.invalidateQueries({ queryKey: ["tree"] });
  void queryClient.invalidateQueries({ queryKey: ["wiki"] });
  void queryClient.invalidateQueries({ queryKey: ["favorites"] });
  void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["history"] });
  void queryClient.invalidateQueries({ queryKey: ["repo-history"] });
  void queryClient.invalidateQueries({ queryKey: ["changed-files"] });
}

/**
 * 请求编辑器重载当前打开的笔记（配合 invalidateWorkspaceQueries 使用）。
 * 有未落盘草稿时跳过：用户正在编辑，草稿既不丢弃也不被磁盘内容覆盖。
 */
export function requestEditorReloadIfClean(): void {
  if (hasPendingDraft()) return;
  useNoteReloadStore.getState().requestReload();
}
