import { useState } from "react";
import type { NoteKind } from "@/api/types";

export function useCreateMenu(
  onCreateNote: (kind: NoteKind) => Promise<void>,
  onImportFiles: (files: File[]) => Promise<void>,
) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return {
    open,
    busy,
    error,
    toggle: () => { setError(null); setOpen((value) => !value); },
    close: () => setOpen(false),
    createNote: (kind: NoteKind) => run(() => onCreateNote(kind)),
    importFiles: (files: File[]) => files.length ? run(() => onImportFiles(files)) : Promise.resolve(),
  };
}

