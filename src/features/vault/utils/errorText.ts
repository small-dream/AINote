import { isAppError, messageOf } from "@/api/error";
import type { TranslationKey } from "@/i18n/messages";

/** 加密笔记错误码 → 本地化文案（与 Rust `domain/error.rs` 的 VAULT_9xxx 一一对应）。 */
const VAULT_ERROR_KEYS: Record<string, TranslationKey> = {
  VAULT_9001: "vault.errorLocked",
  VAULT_9002: "vault.errorUnlockFailed",
  VAULT_9003: "vault.errorHistoryUnavailable",
  VAULT_9004: "vault.errorInvalid",
  VAULT_9005: "vault.errorCorrupt",
  VAULT_9006: "vault.errorQuickUnlockUnavailable",
  VAULT_9007: "vault.errorDeviceCancelled",
  VAULT_9008: "vault.errorDeviceFailed",
};

export function vaultErrorKey(error: unknown): TranslationKey | null {
  if (!isAppError(error)) return null;
  return VAULT_ERROR_KEYS[error.code] ?? null;
}

/** 用户可读文案：已知错误码走本地化，其余回退后端消息（避免出现无上下文的裸错误码）。 */
export function vaultErrorText(error: unknown, t: (key: TranslationKey) => string): string {
  const key = vaultErrorKey(error);
  return key === null ? messageOf(error) : t(key);
}

/**
 * 设备认证被用户取消：属于正常操作，不应显示成红色错误。
 * 取消后条目仍然有效，用户可以直接重试或改用口令。
 */
export function isVaultDeviceCancel(error: unknown): boolean {
  return isAppError(error) && error.code === "VAULT_9007";
}
