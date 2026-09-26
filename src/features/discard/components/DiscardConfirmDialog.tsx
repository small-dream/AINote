import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";

interface DiscardConfirmDialogProps {
  /** 将恢复到上次提交版本的文件数（改 / 删） */
  restoreCount: number;
  /** 将彻底删除的文件数（新增，无历史版本） */
  deleteCount: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 丢弃前的二次确认：改动不备份、新增文件不回收，必须勾选「我了解无法恢复」才能确认。
 * 由调用方只在确认时挂载：勾选状态随卸载自然清空，不会把上一次的确认沿用到下一次。
 */
export function DiscardConfirmDialog({ restoreCount, deleteCount, busy, onConfirm, onClose }: DiscardConfirmDialogProps) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Modal open title={t("discard.confirmTitle")} onClose={onClose} mobileSheet={false}>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1 text-sm text-text-secondary">
          <li>{t("discard.confirmRestore", { count: restoreCount })}</li>
          <li className={deleteCount > 0 ? "text-danger" : "text-text-secondary"}>
            {t("discard.confirmDelete", { count: deleteCount })}
          </li>
        </ul>
        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={busy}
          />
          <span>{t("discard.confirmAck")}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            className="bg-danger hover:brightness-95"
            onClick={onConfirm}
            disabled={!acknowledged || busy}
          >
            {busy ? t("discard.submitting") : t("discard.confirmAction")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
