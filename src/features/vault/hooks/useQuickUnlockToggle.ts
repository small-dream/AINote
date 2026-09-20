import { useState } from "react";
import { useTranslation } from "@/i18n";
import { isVaultDeviceCancel, vaultErrorText } from "../utils/errorText";
import { quickUnlockOf } from "../utils/quickUnlock";
import { useVaultSettings } from "./useVaultSettings";

/**
 * 设置页开关：开启 / 关闭本机设备级快速解锁。
 * 用户在系统弹窗上取消属于正常操作（VAULT_9007），不展示红色错误。
 */
export function useQuickUnlockToggle() {
  const { t } = useTranslation();
  const { status, enableQuickUnlock, disableQuickUnlock } = useVaultSettings();
  const [error, setError] = useState<string | null>(null);
  const quick = quickUnlockOf(status.data);
  const pending = enableQuickUnlock.isPending || disableQuickUnlock.isPending;

  const toggle = () => {
    setError(null);
    const mutation = quick.enabled ? disableQuickUnlock : enableQuickUnlock;
    mutation.mutate(undefined, {
      onError: (cause: unknown) => {
        if (!isVaultDeviceCancel(cause)) setError(vaultErrorText(cause, t));
      },
    });
  };

  return { quick, pending, error, toggle };
}
