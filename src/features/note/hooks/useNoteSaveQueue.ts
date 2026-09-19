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

export function useNoteSaveQueue({ repoPath, notePath, draft, dirty, setDirty, isLoaded, debounceMs }: UseNoteSaveQueueOptions) {
  const save = useUpdateNoteMutation(repoPath);
  const reset = save.reset;
  const [saving, setSaving] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const latest = useRef({ draft, dirty, notePath, save });

  useEffect(() => { latest.current = { draft, dirty, notePath, save }; });

  useEffect(() => { reset(); }, [notePath, repoPath, reset]);

  const saveDraft = useCallback(async (contentOverride?: string): Promise<void> => {
    if (inFlight.current) await inFlight.current;
    const current = latest.current;
    // 显式传入内容时视为脏（调用方刚 onChange，React 状态可能尚未落盘到 latest）
    if (!current.notePath || (!current.dirty && contentOverride === undefined) || !isLoaded()) return;
    const path = current.notePath;
    const content = contentOverride ?? current.draft;
    setSaving(true);
    const request = current.save
      .mutateAsync({ path, content })
      .then(() => { if (latest.current.notePath === path && latest.current.draft === content) setDirty(false); })
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
