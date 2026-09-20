import { useState } from "react";
import { useTranslation } from "@/i18n";
import { isVaultDeviceCancel, vaultErrorText } from "../utils/errorText";
import { quickUnlockKindLabel, quickUnlockOf } from "../utils/quickUnlock";
import { useVaultSettings } from "./useVaultSettings";

/**
 * 锁定态的「用 Touch ID / Face ID / 指纹解锁」动作。
 * 只有本机已开启快速解锁时按钮才会出现（`quick.enabled`）。
 */
export function useVaultDeviceUnlock() {
  const { t } = useTranslation();
  const { status, unlockWithDevice } = useVaultSettings();
  const [error, setError] = useState<string | null>(null);
  const quick = quickUnlockOf(status.data);

  const unlock = (onUnlocked?: () => void) => {
    if (unlockWithDevice.isPending) return;
    setError(null);
    unlockWithDevice.mutate(undefined, {
      onSuccess: () => onUnlocked?.(),
      // 取消是正常操作：回到口令输入即可，不展示错误。
      onError: (cause: unknown) => {
        if (!isVaultDeviceCancel(cause)) setError(vaultErrorText(cause, t));
      },
    });
  };

  return {
    quick,
    kindLabel: quickUnlockKindLabel(quick.kind, t),
    pending: unlockWithDevice.isPending,
    error,
    unlock,
  };
}
