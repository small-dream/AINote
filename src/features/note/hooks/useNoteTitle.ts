import { useState } from "react";
import { messageOf } from "@/api";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { getDirectoryPath } from "@/features/file-tree/utils/path";
import { applyRichTextTitle } from "@/features/richtext/utils/richText";
import { noteDisplayName } from "../utils/displayName";
import { applyMarkdownTitle } from "../utils/markdown";
import { joinNotePath, normalizeNotePath } from "../utils/path";
import { noteKindOfPath } from "../utils/noteKind";
import { useTranslation } from "@/i18n";

interface UseNoteTitleOptions {
  notePath: string;
  isNewNote: boolean;
  draft: string;
  onChange: (value: string) => void;
  flush: () => Promise<void>;
  onRenamed: (path: string) => void;
}

/** 新建笔记的「输入标题 = 改文件名」编排：Enter/失焦时立即提交。 */
export function useNoteTitle({ notePath, isNewNote, draft, onChange, flush, onRenamed }: UseNoteTitleOptions) {
  const { t } = useTranslation();
  const rename = useMoveNoteMutation();
  const [value, setValue] = useState(() => (isNewNote ? "" : noteDisplayName(notePath.split("/").at(-1) ?? notePath)));
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const title = value.trim();
    if (!title) {
      setValue(isNewNote ? "" : noteDisplayName(notePath.split("/").at(-1) ?? notePath));
      return;
    }
    const fileName = normalizeNotePath(title, noteKindOfPath(notePath));
    if (!fileName) {
      setError(t("note.nameRequired"));
      return;
    }
    const nextPath = joinNotePath(getDirectoryPath(notePath), fileName);
    if (nextPath === notePath) return;
    onChange(noteKindOfPath(notePath) === "richText"
      ? applyRichTextTitle(draft, title)
      : applyMarkdownTitle(draft, title));
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await flush();
      await rename.mutateAsync({ from: notePath, to: nextPath });
      onRenamed(nextPath);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function reset() {
    setValue(isNewNote ? "" : noteDisplayName(notePath.split("/").at(-1) ?? notePath));
    setError(null);
  }

  return { value, error, pending: rename.isPending, setValue, reset, commit };
}
