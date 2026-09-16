import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface EncryptedMergePaneProps {
  resolving: boolean;
  onKeepLocal: () => void;
  onKeepRemote: () => void;
}

/**
 * 加密笔记的冲突降级面板（E5）：不渲染密文，也不提供逐行挑选——
 * 密文之间没有可比较的行结构，只能整体保留一侧。
 */
export function EncryptedMergePane({ resolving, onKeepLocal, onKeepRemote }: EncryptedMergePaneProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center" role="group" aria-label={t("sync.encryptedConflictTitle")}>
      <ShieldAlert size={22} className="text-text-tertiary" />
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium text-text-primary">{t("sync.encryptedConflictTitle")}</p>
        <p className="text-xs text-text-secondary">{t("sync.encryptedConflictDescription")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" disabled={resolving} onClick={onKeepLocal}>
          {t("sync.keepLocal")}
        </Button>
        <Button type="button" variant="ghost" className="border border-border" disabled={resolving} onClick={onKeepRemote}>
          {t("sync.keepRemote")}
        </Button>
      </div>
    </div>
  );
}
