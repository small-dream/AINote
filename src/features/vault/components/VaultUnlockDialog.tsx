import { useEffect } from "react";
import { X } from "lucide-react";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { useBackHandler } from "@/platform/back-navigation";
import { VaultUnlockCard } from "./VaultUnlockCard";

/** 全局解锁弹层：导航轨 / 命令面板 / 移动端入口共用的就地解锁入口，解锁成功自动关闭。 */
export function VaultUnlockDialog() {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.vaultDialogOpen);
  const close = useUiStore((state) => state.closeVaultDialog);
  useBackHandler(open, close);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={t("vault.unlockDialogTitle")} className="w-full max-w-sm rounded-xl bg-bg-primary p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">{t("vault.unlockDialogTitle")}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3">
          <VaultUnlockCard onUnlocked={close} />
        </div>
      </div>
    </div>
  );
}
