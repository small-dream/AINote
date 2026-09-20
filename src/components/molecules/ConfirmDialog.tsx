import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  busy?: boolean;
  /** 破坏性操作（删除等）：确认按钮改用危险色，与文件树的删除确认保持一致 */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 轻量确认框：替代 window.confirm（移动端 WebView 中不可靠），Esc / 遮罩点击即取消。 */
export function ConfirmDialog({ open, title, children, busy = false, danger = false, onConfirm, onClose }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="mb-4 text-sm leading-6 text-text-secondary">{children}</div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button className={danger ? "bg-danger hover:brightness-95" : ""} onClick={onConfirm} disabled={busy}>
          {t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
