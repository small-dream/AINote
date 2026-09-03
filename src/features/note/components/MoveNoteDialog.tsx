import { useState, type FormEvent } from "react";
import { useNoteTreeQuery } from "@/queries/tree.queries";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { collectDirectoryOptions, type DirectoryOption } from "../utils/directoryTree";
import { getNoteFileName, joinNotePath } from "../utils/path";
import { useTranslation } from "@/i18n";
import { getDirectoryPath } from "@/features/file-tree/utils/path";
import { MoveDirectoryTree } from "./MoveDirectoryTree";

interface MoveNoteDialogProps {
  repoPath: string | null;
  path: string | null;
  onClose: () => void;
  onMoved: (to: string) => void;
}

/** 移动笔记：从目录树选择目标目录，保留当前文件名。父组件以 key={path} 重建。 */
export function MoveNoteDialog({ repoPath, path, onClose, onMoved }: MoveNoteDialogProps) {
  const { t } = useTranslation();
  const move = useMoveNoteMutation();
  const { data: tree, isLoading } = useNoteTreeQuery(repoPath);
  const directories = collectDirectoryOptions(tree ?? null);
  const [targetDir, setTargetDir] = useState(getDirectoryPath(path ?? ""));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!path) return;
    const to = joinNotePath(targetDir, getNoteFileName(path));
    if (to === path) {
      onClose();
      return;
    }
    move.mutate({ from: path, to }, { onSuccess: () => { onMoved(to); onClose(); } });
  }

  const mutateMessage = move.isError ? messageOf(move.error) : null;

  return (
    <Modal open={path !== null} title={t("note.moveTitle")} onClose={onClose}>
      <MoveNoteForm
        current={path}
        directories={directories}
        isLoading={isLoading}
        targetDir={targetDir}
        pending={move.isPending}
        mutateMessage={mutateMessage}
        onTargetChange={setTargetDir}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface MoveNoteFormProps {
  current: string | null;
  directories: DirectoryOption[];
  isLoading: boolean;
  targetDir: string;
  pending: boolean;
  mutateMessage: string | null;
  onTargetChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

function MoveNoteForm({
  current,
  directories,
  isLoading,
  targetDir,
  pending,
  mutateMessage,
  onTargetChange,
  onCancel,
  onSubmit,
}: MoveNoteFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <p className="mb-3 text-xs text-text-secondary">{t("note.current", { path: current ?? "" })}</p>
      <MoveDirectoryTree
        directories={directories}
        isLoading={isLoading}
        selectedDir={targetDir}
        onSelect={onTargetChange}
      />
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
