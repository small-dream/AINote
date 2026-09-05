import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCreateNoteMutation,
  useNoteListQuery,
} from "@/queries/note.queries";
import type { NoteKind } from "@/api/types";
import { uniqueUntitledNotePath } from "../utils/template";

export type CreateNote = (dir: string, kind?: NoteKind) => Promise<void>;

/** 新建笔记编排：未命名即时创建、重名递增、创建成功后打开（P0/P1） */
export function useNewNote(repoPath: string | null, onOpen: (path: string) => void) {
  const create = useCreateNoteMutation();
  const { data: allNotes } = useNoteListQuery(repoPath);
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  const existingPaths = useMemo(
    () => new Set((allNotes ?? []).map((note) => note.path)),
    [allNotes]
  );

  const requestNew = useCallback<CreateNote>(async (dir, kind = "markdown") => {
    const path = uniqueUntitledNotePath(dir, kind, existingPaths);
    const note = await create.mutateAsync({ path, kind, content: "" });
    setCreatedPath(note.path);
    onOpen(note.path);
  }, [create, existingPaths, onOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void requestNew("").catch(() => undefined);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestNew]);

  return { existingPaths, createdPath, requestNew };
}
