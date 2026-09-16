import type { VaultState } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { VaultCreateCard } from "./VaultCreateCard";
import { VaultPolicyNotes } from "./VaultPolicyNotes";
import { VaultStatusHeader } from "./VaultStatusHeader";
import { VaultUnlockedCard } from "./VaultUnlockedCard";
import { VaultUnlockCard } from "./VaultUnlockCard";

/** 设置页「加密笔记」内容区：状态 + 建库/解锁/锁定/改口令（标题由设置视图统一提供）。 */
export function VaultSettings() {
  const { t } = useTranslation();
  const { status } = useVaultSettings();

  if (status.isLoading) {
    return <p className="text-xs text-text-secondary">{t("common.loading")}</p>;
  }
  if (status.isError) {
    return (
      <p className="text-xs text-danger" role="alert">
        {t("vault.statusFailed")}
      </p>
    );
  }

  const state: VaultState = status.data?.state ?? "absent";
  return (
    <div className="flex flex-col gap-3">
      <VaultStatusHeader state={state} count={status.data?.encryptedNotes ?? 0} />
      {state === "absent" && <VaultCreateCard />}
      {state === "locked" && <VaultUnlockCard />}
      {state === "unlocked" && <VaultUnlockedCard />}
      <VaultPolicyNotes />
    </div>
  );
}
