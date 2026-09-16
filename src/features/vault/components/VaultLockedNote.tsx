import { Lock } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";

/**
 * 锁定态编辑区占位：加密笔记未解锁时只显示该面板——
 * 不渲染编辑器、不渲染密文，也不允许产生任何草稿写入。
 */
export function VaultLockedNote({ notePath }: { notePath: string }) {
  const { t } = useTranslation();
  const openSettings = useUiStore((state) => state.openSettings);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Lock size={22} className="text-text-tertiary" />
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-text-primary">{t("vault.lockedNoteTitle")}</p>
        <p className="text-xs text-text-secondary">{t("vault.lockedNotePath", { path: notePath })}</p>
      </div>
      <Button type="button" onClick={() => openSettings("vault")}>
        {t("vault.lockedNoteUnlock")}
      </Button>
    </div>
  );
}
