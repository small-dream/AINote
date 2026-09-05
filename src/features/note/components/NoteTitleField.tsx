import type { KeyboardEvent } from "react";
import { useTranslation } from "@/i18n";
import { useNoteTitle } from "../hooks/useNoteTitle";

interface NoteTitleFieldProps {
  notePath: string;
  isNewNote: boolean;
  draft: string;
  onChange: (value: string) => void;
  flush: () => Promise<void>;
  onRenamed: (path: string) => void;
}

/** 工具栏内的就地标题：输入后 Enter 或失焦直接改名，避免二次弹窗。 */
export function NoteTitleField({ notePath, isNewNote, draft, onChange, flush, onRenamed }: NoteTitleFieldProps) {
  const { t } = useTranslation();
  const { value, error, pending, setValue, reset, commit } = useNoteTitle({ notePath, isNewNote, draft, onChange, flush, onRenamed });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
    if (event.key === "Escape") reset();
  }

  return (
    <input
      aria-label={t("note.title")}
      aria-invalid={error ? true : undefined}
      autoFocus={isNewNote}
      className={`note-title-input field-sizing-content min-w-16 max-w-56 truncate border-b bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-text-primary outline-none placeholder:text-text-tertiary ${error ? "border-danger" : "border-transparent"}`}
      placeholder={t("note.untitled")}
      title={t("note.title")}
      value={value}
      disabled={pending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={handleKeyDown}
    />
  );
}
