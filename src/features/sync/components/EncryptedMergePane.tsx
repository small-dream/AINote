import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { ConflictPending } from "../hooks/useConflictMerge";

interface EncryptedMergePaneProps {
  pending: ConflictPending;
  disabled: boolean;
  onKeepLocal: () => void;
  onKeepRemote: () => void;
}

/**
 * 加密笔记的冲突降级面板（E5）：不渲染密文，也不提供逐行挑选——
 * 密文之间没有可比较的行结构，只能整体保留一侧；点按钮即写回该侧原文并收尾。
 */
export function EncryptedMergePane({ pending, disabled, onKeepLocal, onKeepRemote }: EncryptedMergePaneProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center" role="group" aria-label={t("sync.encryptedConflictTitle")}>
      <ShieldAlert size={22} className="text-text-tertiary" />
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium text-text-primary">{t("sync.encryptedConflictTitle")}</p>
        <p className="text-xs text-text-secondary">{t("sync.encryptedConflictDescription")}</p>
      </div>
      <div className="flex w-full max-w-xs items-center gap-2">
        <Button type="button" className="min-h-11 flex-1" disabled={disabled} onClick={onKeepLocal}>
          {pending === "local" ? t("sync.resolving") : t("sync.keepLocal")}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 flex-1 border border-border" disabled={disabled} onClick={onKeepRemote}>
          {pending === "remote" ? t("sync.resolving") : t("sync.keepRemote")}
        </Button>
      </div>
    </div>
  );
}
