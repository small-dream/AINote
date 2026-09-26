import { useTranslation } from "@/i18n";
import { Modal } from "@/components/molecules/Modal";
import { Button } from "@/components/atoms/Button";
import { useDiscardDialog } from "../hooks/useDiscardDialog";
import { DiscardConfirmDialog } from "./DiscardConfirmDialog";
import { DiscardFileList } from "./DiscardFileList";

interface DiscardDialogProps {
  repoPath: string | null;
  onClose: () => void;
}

/** 丢弃本地改动（P1）：待提交变更列表 + 多选 / 全选 + 二次确认，按文件回滚到上次提交。 */
export function DiscardDialog({ repoPath, onClose }: DiscardDialogProps) {
  const { t } = useTranslation();
  const dialog = useDiscardDialog(repoPath, onClose);

  return (
    <>
      <Modal open={!dialog.confirming} title={t("discard.title")} onClose={onClose}>
        <div className="flex flex-col gap-3">
          <DiscardFileList
            files={dialog.files}
            loading={dialog.loading}
            allSelected={dialog.allSelected}
            selectedCount={dialog.selectedCount}
            isSelected={dialog.isSelected}
            onToggle={dialog.toggle}
            onToggleAll={dialog.toggleAll}
          />
          <p className="text-xs text-text-tertiary">{t("discard.hint")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={dialog.submitting}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-danger hover:brightness-95"
              onClick={dialog.openConfirm}
              disabled={!dialog.canSubmit}
            >
              {t("discard.submit")}
            </Button>
          </div>
        </div>
      </Modal>
      {dialog.confirming ? (
        <DiscardConfirmDialog
          restoreCount={dialog.restoreCount}
          deleteCount={dialog.deleteCount}
          busy={dialog.submitting}
          onConfirm={dialog.submit}
          onClose={dialog.closeConfirm}
        />
      ) : null}
    </>
  );
}
