import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { RotateCcw } from "lucide-react";

export interface PendingDelete { path: string; name: string; isFolder: boolean; }

interface DeleteConfirmDialogProps {
  pending: PendingDelete | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 恢复入口：跳到回收站面板（E3-T5） */
  onOpenTrash: () => void;
}

export function DeleteConfirmDialog({ pending, busy, onClose, onConfirm, onOpenTrash }: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  if (!pending) return null;
  return <Modal open title={pending.isFolder ? t("tree.deleteFolder") : t("tree.deleteNote")} onClose={busy ? () => undefined : onClose}>
    <p className="mb-2 text-sm text-text-primary">{t("common.deleteConfirm", { name: pending.name })}</p>
    <p className="mb-2 text-xs leading-5 text-text-secondary">{pending.isFolder ? t("common.folderDeleteWarning") : t("common.noteDeleteWarning")}</p>
    <p className="mb-5 flex items-center gap-1.5 text-xs text-text-secondary">
      <RotateCcw size={13} aria-hidden="true" />
      <span>{t("common.trashRecoveryEntry")}</span>
      <button type="button" disabled={busy} onClick={onOpenTrash} className="underline underline-offset-2 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
        {t("common.openTrash")}
      </button>
    </p>
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
      <Button variant="primary" className="bg-danger hover:brightness-95" onClick={onConfirm} disabled={busy}>{busy ? t("common.deleting") : t("common.delete")}</Button>
    </div>
  </Modal>;
}
