import { useTranslation } from "@/i18n";
import { Modal } from "@/components/molecules/Modal";
import { Button } from "@/components/atoms/Button";
import { TriangleAlert } from "lucide-react";
import { useCloseGuard } from "../hooks/useCloseGuard";

/** 桌面退出确认框：有待提交变更时阻止窗口关闭，由用户决定是否仍要退出。 */
export function CloseConfirmDialog() {
  const { t } = useTranslation();
  const { open, confirm, cancel } = useCloseGuard();
  return (
    <Modal open={open} title={t("closeGuard.title")} onClose={cancel}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 text-sm text-text-secondary">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <p>{t("closeGuard.description")}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm}>{t("closeGuard.confirm")}</Button>
        </div>
      </div>
    </Modal>
  );
}
