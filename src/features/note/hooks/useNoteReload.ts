import { useCallback, useEffect, useRef } from "react";
import type { NoteContent } from "@/api/types";

interface UseNoteReloadOptions {
  notePath: string | null;
  data: NoteContent | undefined;
  reloadToken: number;
  applyContent: (content: string) => void;
}

/** 笔记内容装载编排：路径切换时装载一次；reloadToken 变化时允许重载（如 Git 历史恢复）。 */
export function useNoteReload({ notePath, data, reloadToken, applyContent }: UseNoteReloadOptions) {
  const loadedForRef = useRef<string | null>(null);
  const previousReload = useRef(reloadToken);

  useEffect(() => {
    if (data && loadedForRef.current !== notePath) {
      loadedForRef.current = notePath;
      applyContent(data.content);
    }
  }, [data, notePath, applyContent]);

  useEffect(() => {
    if (reloadToken !== previousReload.current) {
      previousReload.current = reloadToken;
      loadedForRef.current = null;
    }
  }, [reloadToken]);

  /** 当前草稿是否对应当前笔记（防止旧笔记草稿自动保存到新笔记） */
  return useCallback(() => loadedForRef.current === notePath, [notePath]);
}
