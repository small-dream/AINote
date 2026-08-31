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

  const saveDraft = useCallback(async (): Promise<void> => {
    if (inFlight.current) await inFlight.current;
    const current = latest.current;
    if (!current.notePath || !current.dirty || !isLoaded()) return;
    const path = current.notePath;
    const content = current.draft;
    setSaving(true);
    const request = current.save
      .mutateAsync({ path, content })
      .then(() => { if (latest.current.notePath === path && latest.current.draft === content) setDirty(false); })
      .finally(() => setSaving(false));
    inFlight.current = request;
    try { await request; } finally { if (inFlight.current === request) inFlight.current = null; }
  }, [isLoaded, setDirty]);

  useEffect(() => {
    if (!dirty || !isLoaded() || !notePath) return;
    const handle = setTimeout(() => void saveDraft().catch(() => undefined), debounceMs);
    return () => clearTimeout(handle);
  }, [debounceMs, dirty, isLoaded, notePath, saveDraft]);

  return { saving, saveError: save.error as AppError | null, flush: saveDraft, reset };
}
