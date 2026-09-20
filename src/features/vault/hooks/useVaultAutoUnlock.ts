import { useEffect, useRef } from "react";
import { useVaultUnlockStore } from "@/stores/vault-unlock.store";

interface VaultAutoUnlockOptions {
  /** 本机是否已开启快速解锁：为 true 且闸门允许时才会自动弹系统认证 */
  enabled: boolean;
  unlock: () => void;
}

/**
 * 解锁界面出现时自动触发一次设备认证（Touch ID / Face ID / 指纹 / 设备密码）。
 * 每个界面组件只自动触发一次；全局闸门保证同一锁定周期内多个界面不会重复弹窗。
 */
export function useVaultAutoUnlock({ enabled, unlock }: VaultAutoUnlockOptions) {
  const unlockRef = useRef(unlock);
  useEffect(() => {
    unlockRef.current = unlock;
  });
  // 订阅闸门：用户重新表达解锁意图（打开加密笔记 / 打开解锁弹层）后会再次评估。
  const suppressed = useVaultUnlockStore((state) => state.suppressed);
  const spent = useVaultUnlockStore((state) => state.spent);
  useEffect(() => {
    if (!enabled) return;
    // consumeAuto 原子取用：多个解锁界面同时挂载时只会有一个真正弹窗。
    if (!useVaultUnlockStore.getState().consumeAuto()) return;
    unlockRef.current();
  }, [enabled, suppressed, spent]);
}
