import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { normalizeNotePath } from "../utils/path";

interface MoveNoteDialogProps {
  path: string | null;
  onClose: () => void;
  onMoved: (to: string) => void;
}

/** 重命名 / 移动笔记：输入目标路径。父组件以 key={path} 重建以重置草稿。 */
export function MoveNoteDialog({ path, onClose, onMoved }: MoveNoteDialogProps) {
  const move = useMoveNoteMutation();
  const [to, setTo] = useState(path ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!path) return;
    const normalized = normalizeNotePath(to);
    if (!normalized) {
      setError("请输入目标路径");
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
    <Modal open={path !== null} title="重命名 / 移动" onClose={onClose}>
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
  return (
    <form onSubmit={onSubmit}>
      <p className="mb-3 text-xs text-text-secondary">当前：{current}</p>
      <input
        autoFocus
        className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder="目标路径，如 daily/新名字.md"
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
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "移动中…" : "确认"}
        </Button>
      </div>
    </form>
  );
}
