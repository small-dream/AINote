import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface ConflictDialogProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onResolve: (useLocal: boolean) => void;
}

/** Pull 冲突解决（MVP：保留本地 / 使用远端 二选一，见 PRD 冲突策略） */
export function ConflictDialog({ open, pending, onClose, onResolve }: ConflictDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">{t("sync.conflictTitle")}</h2>
        <p className="mb-6 text-sm text-text-secondary">
          {t("sync.conflictDescription")}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("sync.later")}
          </Button>
          <Button variant="ghost" onClick={() => onResolve(false)} disabled={pending}>
            {t("sync.remote")}
          </Button>
          <Button variant="primary" onClick={() => onResolve(true)} disabled={pending}>
            {pending ? t("sync.resolving") : t("sync.keepLocal")}
          </Button>
        </div>
      </div>
    </div>
  );
}
