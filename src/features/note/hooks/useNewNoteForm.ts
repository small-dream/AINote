import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import type { NoteKind } from "@/api/types";
import type { NewNoteInput } from "../types";
import { joinNotePath, normalizeNotePath } from "../utils/path";
import {
  defaultNoteFileName,
  renderNoteTemplate,
  type NoteTemplate,
} from "../utils/template";
import { useTranslation } from "@/i18n";

/** 生成当前类型/模板的默认路径 */
function defaultPath(dir: string, kind: NoteKind, template: NoteTemplate): string {
  return joinNotePath(dir, defaultNoteFileName(kind, template, new Date()));
}

/** 新建对话框表单编排：类型 + 模板 + 路径 + pending/error（P2 模板选择） */
export function useNewNoteForm(dir: string, onCreate: (input: NewNoteInput) => Promise<void>) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<NoteKind>("markdown");
  const [template, setTemplate] = useState<NoteTemplate>("default");
  const [path, setPath] = useState(() => defaultPath(dir, "markdown", "default"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changePath(value: string) {
    setPath(value);
    setError(null);
  }

  function changeTemplate(next: NoteTemplate) {
    setTemplate(next);
    setPath(defaultPath(dir, kind, next));
    setError(null);
  }

  function changeKind(next: NoteKind) {
    setKind(next);
    setPath(defaultPath(dir, next, template));
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeNotePath(path, kind);
    if (!normalized) {
      setError(t("note.pathRequired"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate({ path: normalized, kind, content: renderNoteTemplate(kind, template, new Date()) });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return { kind, template, path, error, pending, changePath, changeTemplate, changeKind, submit };
}
