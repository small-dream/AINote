import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import type { NewNoteInput } from "../types";
import { joinNotePath, normalizeNotePath } from "../utils/path";
import {
  defaultNoteFileName,
  renderNoteTemplate,
  type NoteTemplate,
} from "../utils/template";

/** 新建对话框表单编排：模板 + 路径 + pending/error（P2 模板选择） */
export function useNewNoteForm(dir: string, onCreate: (input: NewNoteInput) => Promise<void>) {
  const [template, setTemplate] = useState<NoteTemplate>("default");
  const [path, setPath] = useState(() =>
    joinNotePath(dir, defaultNoteFileName("default", new Date()))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changePath(value: string) {
    setPath(value);
    setError(null);
  }

  function changeTemplate(next: NoteTemplate) {
    setTemplate(next);
    setPath(joinNotePath(dir, defaultNoteFileName(next, new Date())));
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeNotePath(path);
    if (!normalized) {
      setError("请输入笔记路径");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate({ path: normalized, content: renderNoteTemplate(template, new Date()) });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return { template, path, error, pending, changePath, changeTemplate, submit };
}
