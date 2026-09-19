import { useCallback, useEffect, useRef, useState } from "react";
import type { AppError } from "@/api";
import { useNoteContentQuery } from "@/queries/note.queries";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import { useNoteReload } from "./useNoteReload";
import { useNoteSaveQueue } from "./useNoteSaveQueue";
import { noteKindOfPath } from "../utils/noteKind";
import { publishDraftState, registerDraft } from "../utils/draftRegistry";

/** 自动保存窗口：首次变更后最长 3 秒写入本地文件（连续输入期间同样会落盘，不会无限推迟）。 */
export const AUTOSAVE_DEBOUNCE_MS = 3_000;

export interface NoteEditorHandle {
  /** 立即保存未保存的草稿（切换笔记前调用）；可显式传入待保存内容，避免赌 React 状态落盘时序 */
  flush: (content?: string) => Promise<void>;
  setMode: (mode: "edit" | "split" | "preview") => void;
  insertCallout: () => void;
  openHistory: () => void;
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
  // 工作区级重载信号（同步 / 冲突解决 / Git Graph 恢复）与历史面板纪元合并为一个递增令牌
  const workspaceReloadEpoch = useNoteReloadStore((state) => state.epoch);
  const isLoaded = useNoteReload({ notePath, data: contentQuery.data, reloadToken: reloadToken + workspaceReloadEpoch, dirty, applyContent });
  const kind = contentQuery.data?.kind ?? (notePath ? noteKindOfPath(notePath) : "markdown");
  /** 加密笔记在锁定态：正文不参与编辑，界面改由解锁面板接管（后端连明文都不返回）。 */
  const locked = contentQuery.data?.locked === true;
  /** 是否为加密笔记（解锁后仍为 true）：用于关闭 AI 与版本历史入口。 */
  const encrypted = contentQuery.data?.encrypted === true;

  const { flush, reset, saving, saveError } = useNoteSaveQueue({ repoPath, notePath, draft, dirty, setDirty, isLoaded, debounceMs: AUTOSAVE_DEBOUNCE_MS });

  // 登记未落盘草稿：关闭窗口 / 切换仓库前由 draftRegistry 统一 flush 并上报 Rust。
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
    publishDraftState();
  }, [dirty]);
  useEffect(() => registerDraft({ flush, isDirty: () => dirtyRef.current }), [flush]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void flush().catch(() => undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  // 移动端进入后台时系统可能立即冻结 WebView，先把当前草稿送入保存队列。
  useEffect(() => {
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") void flush().catch(() => undefined);
    };
    const flushOnPageHide = () => { void flush().catch(() => undefined); };
    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
    };
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
    locked,
    encrypted,
  };
}
