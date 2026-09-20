import type { QuickUnlockKind, QuickUnlockStatus } from "@/api/types";
import type { TranslationKey } from "@/i18n/messages";

/** 平台不支持 / 未开启：不渲染入口时使用同一常量，避免各处重复构造。 */
export const DISABLED_QUICK_UNLOCK: QuickUnlockStatus = {
  supported: false,
  enabled: false,
  kind: null,
};

/**
 * 归一化设备级快速解锁状态。
 * 老后端与部分测试夹具不带该字段，组件一律经此读取，避免出现 `undefined.enabled` 这类崩溃。
 */
export function quickUnlockOf(status: { quickUnlock?: QuickUnlockStatus } | undefined): QuickUnlockStatus {
  const value = status?.quickUnlock;
  if (!value) return DISABLED_QUICK_UNLOCK;
  return {
    supported: value.supported === true,
    enabled: value.enabled === true,
    kind: value.kind ?? null,
  };
}

const KIND_LABEL_KEYS: Record<QuickUnlockKind, TranslationKey> = {
  touchId: "vault.deviceKindTouchId",
  faceId: "vault.deviceKindFaceId",
  opticId: "vault.deviceKindOpticId",
  biometric: "vault.deviceKindBiometric",
  deviceCredential: "vault.deviceKindDeviceCredential",
};

/** 认证方式的用户可见名称；未知 / 缺失时给通用文案，绝不显示裸标识符。 */
export function quickUnlockKindLabel(
  kind: QuickUnlockKind | null | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (!kind) return t("vault.deviceKindDefault");
  const key = KIND_LABEL_KEYS[kind];
  return key ? t(key) : t("vault.deviceKindDefault");
}
