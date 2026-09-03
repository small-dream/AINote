import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { normalizeNotePath } from "../utils/path";
import { noteKindOfPath } from "../utils/noteKind";
import { useTranslation } from "@/i18n";

interface MoveNoteDialogProps {
  path: string | null;
  onClose: () => void;
  onMoved: (to: string) => void;
}

/** 移动笔记：输入目标路径。父组件以 key={path} 重建以重置草稿。 */
export function MoveNoteDialog({ path, onClose, onMoved }: MoveNoteDialogProps) {
  const { t } = useTranslation();
  const move = useMoveNoteMutation();
  const [to, setTo] = useState(path ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!path) return;
    const normalized = normalizeNotePath(to, noteKindOfPath(path));
    if (!normalized) {
      setError(t("note.targetRequired"));
      return;
    }
    if (normalized === path) {
      onClose();
      return;
    }
    move.mutate({ from: path, to: normalized }, { onSuccess: () => { onMoved(normalized); onClose(); } });
  }

  const mutateMessage = move.isError ? messageOf(move.error) : null;

  return (
    <Modal open={path !== null} title={t("note.moveTitle")} onClose={onClose}>
      <MoveNoteForm
        current={path}
        to={to}
        error={error}
        pending={move.isPending}
        mutateMessage={mutateMessage}
        onToChange={(value) => setTo(value)}
        onErrorReset={() => setError(null)}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface MoveNoteFormProps {
  current: string | null;
  to: string;
  error: string | null;
  pending: boolean;
  mutateMessage: string | null;
  onToChange: (value: string) => void;
  onErrorReset: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

function MoveNoteForm({
  current,
  to,
  error,
  pending,
  mutateMessage,
  onToChange,
  onErrorReset,
  onCancel,
  onSubmit,
}: MoveNoteFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <p className="mb-3 text-xs text-text-secondary">{t("note.current", { path: current ?? "" })}</p>
      <input
        autoFocus
        className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder={t("note.targetPath")}
        value={to}
        onChange={(e) => {
          onToChange(e.target.value);
          onErrorReset();
        }}
      />
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      {mutateMessage && <p className="mb-2 text-xs text-danger">{mutateMessage}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("common.moving") : t("common.confirm")}
        </Button>
      </div>
    </form>
  );
}
