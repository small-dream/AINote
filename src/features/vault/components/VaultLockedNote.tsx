import { Lock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { VaultUnlockCard } from "./VaultUnlockCard";

/**
 * 锁定态编辑区占位：加密笔记未解锁时只显示该面板——
 * 内嵌解锁表单，不渲染编辑器、不渲染密文，也不允许产生任何草稿写入。
 */
export function VaultLockedNote({ notePath }: { notePath: string }) {
  const { t } = useTranslation();
  const openSettings = useUiStore((state) => state.openSettings);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <Lock size={22} className="text-text-tertiary" />
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-text-primary">{t("vault.lockedNoteTitle")}</p>
        <p className="text-xs text-text-secondary">{t("vault.lockedNotePath", { path: notePath })}</p>
      </div>
      <div className="w-full max-w-sm text-left">
        <VaultUnlockCard />
      </div>
      <button
        type="button"
        className="text-xs text-text-tertiary transition-colors hover:text-text-secondary"
        onClick={() => openSettings("vault")}
      >
        {t("vault.manageSettings")}
      </button>
    </div>
  );
}
