import { useCallback, useEffect, useRef } from "react";
import type { NoteContent } from "@/api/types";

interface UseNoteReloadOptions {
  notePath: string | null;
  data: NoteContent | undefined;
  reloadToken: number;
  /** 当前是否有未落盘草稿：锁定翻转重载时避免冲掉用户输入 */
  dirty: boolean;
  applyContent: (content: string) => void;
}

/** 笔记内容装载编排：路径切换时装载一次；reloadToken 变化时允许重载（如 Git 历史恢复）；
 * 同一路径 locked → unlocked 翻转时重载一次（锁定占位必须被明文替换，否则空草稿会被自动保存覆盖原文）。 */
export function useNoteReload({ notePath, data, reloadToken, dirty, applyContent }: UseNoteReloadOptions) {
  const loadedForRef = useRef<string | null>(null);
  /** 当前 draft 是否来自锁定占位（锁定态 content 为空串且编辑器被遮罩替换，用户不可编辑）。 */
  const loadedLockedRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const previousReload = useRef(reloadToken);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!data) return;
    if (loadedForRef.current !== notePath) {
      loadedForRef.current = notePath;
      loadedLockedRef.current = data.locked;
      applyContent(data.content);
      return;
    }
    // 同一路径 locked → unlocked（如打开锁定笔记后在设置覆盖层解锁，工作区不卸载、query 重取到明文）：
    // 装载守卫会挡住 applyContent，draft 停留在锁定占位的空串，用户一输入就会被防抖保存整体覆盖原文。
    // 仅当 draft 仍是未编辑过的锁定占位（无脏草稿）时重载，绝不覆盖用户输入。
    if (loadedLockedRef.current && !data.locked && !dirtyRef.current) {
      loadedLockedRef.current = false;
      applyContent(data.content);
    }
    // 对称的 unlocked → locked 方向有意不动 draft：锁定时先 flush 保存队列（方案 §6），
    // 且编辑器被遮罩替换不可见；强行清空反而会丢掉 flush 失败时仅存的草稿。
  }, [data, notePath, applyContent]);

  useEffect(() => {
    if (reloadToken !== previousReload.current) {
      previousReload.current = reloadToken;
      loadedForRef.current = null;
      loadedLockedRef.current = false;
    }
  }, [reloadToken]);

  /** 当前草稿是否对应当前笔记（防止旧笔记草稿自动保存到新笔记） */
  return useCallback(() => loadedForRef.current === notePath, [notePath]);
}
