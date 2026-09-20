import { call } from "./client";
import type { NoteMeta, VaultStatusResponse } from "./types";

/**
 * 加密笔记 IPC（E2）。
 * 口令只在此处透传：前端不缓存、不写入任何持久化状态，密钥永远留在 Rust 侧内存。
 */
export const vaultApi = {
  status: () => call<VaultStatusResponse>("vault_status"),
  create: (passphrase: string) => call<VaultStatusResponse>("vault_create", { passphrase }),
  unlock: (passphrase: string) => call<VaultStatusResponse>("vault_unlock", { passphrase }),
  lock: () => call<VaultStatusResponse>("vault_lock"),
  changePassphrase: (oldPassphrase: string, newPassphrase: string) =>
    call<VaultStatusResponse>("vault_change_passphrase", { oldPassphrase, newPassphrase }),
  /** 设备级快速解锁（P0）：开启 / 关闭 / 用设备认证解锁（会弹出系统认证界面） */
  enableQuickUnlock: () => call<VaultStatusResponse>("vault_quick_unlock_enable"),
  disableQuickUnlock: () => call<VaultStatusResponse>("vault_quick_unlock_disable"),
  unlockWithDevice: () => call<VaultStatusResponse>("vault_unlock_with_device"),
  /** 逐篇开关（E4）：把已有笔记切换为加密态 / 明文态 */
  setNoteEncryption: (path: string, encrypted: boolean) =>
    call<NoteMeta>("vault_set_note_encryption", { path, encrypted }),
};
