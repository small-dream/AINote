import { useCallback, useState } from "react";
import { messageOf } from "@/api/error";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useTranslation } from "@/i18n";
import { useVaultUnlockStore } from "@/stores/vault-unlock.store";
import { useVaultSettings } from "./useVaultSettings";

/**
 * 统一的锁定动作：先落盘全部草稿再锁定（锁定后连读回明文的机会都没有）。
 * 供设置页、导航轨、命令面板与空闲自动锁定共用；锁定前有未落盘草稿时中止并报错。
 */
export function useVaultLock() {
  const { lock } = useVaultSettings();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const lockNow = useCallback(() => {
    if (lock.isPending) return;
    setError(null);
    void flushPendingDrafts()
      .then(() => {
        // 用户主动锁定：抑制自动触发，避免解锁界面立刻用设备认证把仓库弹回解锁态。
        useVaultUnlockStore.getState().suppress();
        lock.mutate();
      })
      .catch((error: unknown) => setError(t("vault.lockFlushFailed", { message: messageOf(error) })));
  }, [lock, t]);

  return { lockNow, pending: lock.isPending, error, clearError: () => setError(null) };
}
