import { useCallback, useEffect, useRef, useState } from "react";
import type { AppError } from "@/api";
import { useUpdateNoteMutation } from "@/queries/note.queries";

interface UseNoteSaveQueueOptions {
  repoPath: string | null;
  notePath: string | null;
  draft: string;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  isLoaded: () => boolean;
  debounceMs: number;
}

interface SavedDraft {
  repoPath: string | null;
  notePath: string;
  content: string;
  revision: number;
}

function matchesSavedDraft(
  saved: SavedDraft | null,
  repoPath: string | null,
  notePath: string | null,
  content: string,
  revision: number,
  allowRevisionMatch: boolean,
): boolean {
  if (!saved || saved.repoPath !== repoPath || saved.notePath !== notePath) return false;
  return saved.content === content || (allowRevisionMatch && saved.revision === revision);
}

export function useNoteSaveQueue({ repoPath, notePath, draft, dirty, setDirty, isLoaded, debounceMs }: UseNoteSaveQueueOptions) {
  const save = useUpdateNoteMutation(repoPath);
  const reset = save.reset;
  const [saving, setSaving] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const latest = useRef({ repoPath, draft, dirty, notePath, save });
  const draftRevision = useRef(0);
  const previousDraft = useRef(draft);
  const acknowledged = useRef<SavedDraft | null>(null);

  useEffect(() => {
    if (draft !== previousDraft.current) {
      previousDraft.current = draft;
      draftRevision.current += 1;
    }
    latest.current = { repoPath, draft, dirty, notePath, save };
    if (dirty && matchesSavedDraft(acknowledged.current, repoPath, notePath, draft, draftRevision.current, true)) {
      setDirty(false);
    }
  }, [draft, dirty, notePath, repoPath, save, setDirty]);

  useEffect(() => { reset(); }, [notePath, repoPath, reset]);

  const saveDraft = useCallback(async (contentOverride?: string): Promise<void> => {
    if (inFlight.current) await inFlight.current;
    const current = latest.current;
    // 显式传入内容时视为脏（调用方刚 onChange，React 状态可能尚未落盘到 latest）
    if (!current.notePath || (!current.dirty && contentOverride === undefined) || !isLoaded()) return;
    const path = current.notePath;
    const content = contentOverride ?? current.draft;
    const revision = draftRevision.current;
    if (matchesSavedDraft(acknowledged.current, current.repoPath, path, content, revision, contentOverride === undefined)) {
      if (current.dirty) setDirty(false);
      return;
    }
    setSaving(true);
    const request = current.save
      .mutateAsync({ path, content })
      .then(() => {
        acknowledged.current = { repoPath: current.repoPath, notePath: path, content, revision };
        if (latest.current.repoPath === current.repoPath && latest.current.notePath === path
          && (latest.current.draft === content || draftRevision.current === revision)) setDirty(false);
      })
      .finally(() => setSaving(false));
    inFlight.current = request;
    try { await request; } finally { if (inFlight.current === request) inFlight.current = null; }
  }, [isLoaded, setDirty]);

  useEffect(() => {
    // saving 纳入依赖：保存完成后 dirty 仍为 true（in-flight 期间 draft 继续前进）时，
    // saving 翻转让本 effect 重跑、重新武装防抖；saving 期间不武装，避免与在途保存重叠。
    if (!dirty || saving || !isLoaded() || !notePath) return;
    const handle = setTimeout(() => void saveDraft().catch(() => undefined), debounceMs);
    return () => clearTimeout(handle);
  }, [debounceMs, dirty, saving, isLoaded, notePath, saveDraft]);

  return { saving, saveError: save.error as AppError | null, flush: saveDraft, reset };
}
