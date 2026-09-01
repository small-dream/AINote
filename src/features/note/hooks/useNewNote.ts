import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCreateNoteMutation,
  useNoteListQuery,
} from "@/queries/note.queries";
import type { NewNoteInput } from "../types";

export interface NewNoteDialogState {
  open: boolean;
  dir: string;
}

/** 新建笔记编排：对话框状态 + Cmd/Ctrl+N + 查重 + 创建成功后打开（P0/P1） */
export function useNewNote(repoPath: string | null, onOpen: (path: string) => void) {
  const create = useCreateNoteMutation();
  const { data: allNotes } = useNoteListQuery(repoPath);
  const [dialog, setDialog] = useState<NewNoteDialogState>({ open: false, dir: "" });
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  const existingPaths = useMemo(
    () => new Set((allNotes ?? []).map((note) => note.path)),
    [allNotes]
  );

  const requestNew = useCallback((dir: string) => {
    setDialog({ open: true, dir });
  }, []);

  const close = useCallback(() => {
    setDialog({ open: false, dir: "" });
  }, []);

  const handleCreate = useCallback(
    async (input: NewNoteInput) => {
      const note = await create.mutateAsync({
        path: input.path,
        kind: input.kind,
        content: input.content,
      });
      setCreatedPath(note.path);
      onOpen(note.path);
      close();
    },
    [create, onOpen, close]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        requestNew("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestNew]);

  return { dialog, existingPaths, createdPath, requestNew, close, handleCreate };
}
