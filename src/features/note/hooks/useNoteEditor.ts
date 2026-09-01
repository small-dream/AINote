import { useCallback, useEffect, useState } from "react";
import type { AppError } from "@/api";
import { useNoteContentQuery } from "@/queries/note.queries";
import { useNoteReload } from "./useNoteReload";
import { useNoteSaveQueue } from "./useNoteSaveQueue";
import { noteKindOfPath } from "../utils/noteKind";

/** 自动保存防抖时长：停止输入 3 秒后写入本地文件。 */
export const AUTOSAVE_DEBOUNCE_MS = 3_000;

export interface NoteEditorHandle {
  /** 立即保存未保存的草稿（切换笔记前调用） */
  flush: () => Promise<void>;
  setMode: (mode: "edit" | "split" | "preview") => void;
  insertCallout: () => void;
}

/** 编辑器状态编排：读取笔记 → 草稿 → 3s 防抖自动保存（P0-2）
 * reloadToken 变化时强制重载当前笔记内容（如 Git 历史恢复后）。 */
export function useNoteEditor(repoPath: string | null, notePath: string | null, reloadToken = 0) {
  const contentQuery = useNoteContentQuery(repoPath, notePath);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const applyContent = useCallback((content: string) => {
    setDraft(content);
    setDirty(false);
  }, []);
  const isLoaded = useNoteReload({ notePath, data: contentQuery.data, reloadToken, applyContent });
  const kind = contentQuery.data?.kind ?? (notePath ? noteKindOfPath(notePath) : "markdown");

  const { flush, reset, saving, saveError } = useNoteSaveQueue({ repoPath, notePath, draft, dirty, setDirty, isLoaded, debounceMs: AUTOSAVE_DEBOUNCE_MS });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void flush().catch(() => undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  function onChange(value: string) {
    reset();
    setDraft(value);
    setDirty(true);
  }

  return {
    draft,
    kind,
    onChange,
    flush,
    saving,
    dirty,
    loadError: contentQuery.error as AppError | null,
    saveError,
  };
}
