import { call } from "./client";
import type { NoteMeta, VaultStatus } from "./types";

/**
 * 加密笔记 IPC（E2）。
 * 口令只在此处透传：前端不缓存、不写入任何持久化状态，密钥永远留在 Rust 侧内存。
 */
export const vaultApi = {
  status: () => call<VaultStatus>("vault_status"),
  create: (passphrase: string) => call<VaultStatus>("vault_create", { passphrase }),
  unlock: (passphrase: string) => call<VaultStatus>("vault_unlock", { passphrase }),
  lock: () => call<VaultStatus>("vault_lock"),
  changePassphrase: (oldPassphrase: string, newPassphrase: string) =>
    call<VaultStatus>("vault_change_passphrase", { oldPassphrase, newPassphrase }),
  /** 逐篇开关（E4）：把已有笔记切换为加密态 / 明文态 */
  setNoteEncryption: (path: string, encrypted: boolean) =>
    call<NoteMeta>("vault_set_note_encryption", { path, encrypted }),
};
