import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";

export interface PendingDelete { path: string; name: string; isFolder: boolean; }

export function DeleteConfirmDialog({ pending, busy, onClose, onConfirm }: { pending: PendingDelete | null; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  if (!pending) return null;
  return <Modal open title={pending.isFolder ? t("tree.deleteFolder") : t("tree.deleteNote")} onClose={busy ? () => undefined : onClose}>
    <p className="mb-2 text-sm text-text-primary">{t("common.deleteConfirm", { name: pending.name })}</p>
    <p className="mb-5 text-xs leading-5 text-text-secondary">{pending.isFolder ? t("common.folderDeleteWarning") : t("common.noteDeleteWarning")}</p>
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
      <Button variant="primary" className="bg-danger hover:brightness-95" onClick={onConfirm} disabled={busy}>{busy ? t("common.deleting") : t("common.delete")}</Button>
    </div>
  </Modal>;
}
