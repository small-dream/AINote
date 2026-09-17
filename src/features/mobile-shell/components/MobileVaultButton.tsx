import { Lock, LockOpen } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useVaultLock } from "@/features/vault/hooks/useVaultLock";
import { useVaultStatusQuery } from "@/queries/vault.queries";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

/** 加密笔记状态入口：未建库不显示；已锁定打开全局解锁弹层，已解锁一键锁定。 */
export function MobileVaultButton({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const status = useVaultStatusQuery(repoPath);
  const { lockNow, pending } = useVaultLock();
  const state = status.data?.state;
  if (state === "absent" || state === undefined) return null;
  const unlocked = state === "unlocked";
  const label = unlocked ? t("vault.navUnlocked") : t("vault.navLocked");
  const Icon = unlocked ? LockOpen : Lock;
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className="mobile-icon-button"
        aria-label={label}
        disabled={pending}
        onClick={unlocked ? lockNow : () => useUiStore.getState().openVaultDialog()}
      >
        <Icon size={20} />
      </button>
    </Tooltip>
  );
}
