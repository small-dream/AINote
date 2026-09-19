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
  /** 可显式传入待保存内容，避免赌 React 状态落盘时序 */
  flush: (content?: string) => Promise<void>;
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
    const nextDraft = noteKindOfPath(notePath) === "richText"
      ? applyRichTextTitle(draft, title)
      : applyMarkdownTitle(draft, title);
    onChange(nextDraft);
    try {
      // 显式把新草稿交给 flush：并发渲染下 onChange 的状态未必已落盘，不能再赌一帧时序
      await flush(nextDraft);
      await rename.mutateAsync({ from: notePath, to: nextPath });
      onRenamed(nextPath);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function updateValue(next: string) {
    setValue(next);
    setError(null);
  }

  function reset() {
    setValue(isNewNote ? "" : noteDisplayName(notePath.split("/").at(-1) ?? notePath));
    setError(null);
  }

  return { value, error, pending: rename.isPending, setValue: updateValue, reset, commit };
}
