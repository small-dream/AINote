import { useEffect, useRef, useState } from "react";
import type { AppError } from "@/api";
import { useNoteContentQuery, useUpdateNoteMutation } from "@/queries/note.queries";

/** 自动保存防抖时长（PRD：默认 30s） */
export const AUTOSAVE_DEBOUNCE_MS = 30_000;

export interface NoteEditorHandle {
  /** 立即保存未保存的草稿（切换笔记前调用） */
  flush: () => void;
}

/** 编辑器状态编排：读取笔记 → 草稿 → 30s 防抖自动保存（P0-2） */
export function useNoteEditor(repoPath: string | null, notePath: string | null) {
  const contentQuery = useNoteContentQuery(repoPath, notePath);
  const save = useUpdateNoteMutation();
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const latest = useRef({ draft, dirty, notePath, save });
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { draft, dirty, notePath, save };
  });

  useEffect(() => {
    if (contentQuery.data && loadedForRef.current !== notePath) {
      loadedForRef.current = notePath;
      setDraft(contentQuery.data.content);
      setDirty(false);
    }
  }, [contentQuery.data, notePath]);

  useEffect(() => {
    if (!dirty || loadedForRef.current !== notePath || !notePath) return;
    const handle = setTimeout(() => {
      setSaving(true);
      void latest.current.save.mutateAsync({ path: notePath, content: draft }).finally(() => setSaving(false));
      setDirty(false);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [draft, dirty, notePath]);

  function onChange(value: string) {
    setDraft(value);
    setDirty(true);
  }

  function flush() {
    const s = latest.current;
    if (!s.notePath || !s.dirty || loadedForRef.current !== s.notePath) return;
    setSaving(true);
    void s.save.mutateAsync({ path: s.notePath, content: s.draft }).finally(() => setSaving(false));
    setDirty(false);
  }

  return { draft, onChange, flush, saving, dirty, error: (contentQuery.error ?? save.error) as AppError | null };
}
