/** E2E mock：加密笔记命令。口令不做真实派生，只按固定值判断成功/失败，便于覆盖两条分支。 */

export type E2eVaultState = "absent" | "locked" | "unlocked";

export interface VaultStore {
  vaultState: E2eVaultState;
}

/** 与 Rust 侧默认口令口径一致：e2e 用例只有这一个口令能解锁成功。 */
const E2E_PASSPHRASE = "correct horse battery";

function status(store: VaultStore) {
  return { state: store.vaultState, encryptedNotes: 0 };
}

function unlockFailed(): never {
  throw { code: "VAULT_9002", kind: "auth", message: "vault unlock failed: 口令错误", retriable: false };
}

type VaultCommandHandler = (args: Record<string, unknown>, ctx: { store: VaultStore }) => unknown;

export const vaultCommandHandlers: Record<string, VaultCommandHandler> = {
  vault_status: (_args, ctx) => status(ctx.store),
  vault_create: (_args, ctx) => {
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
  vault_unlock: (args, ctx) => {
    if (args.passphrase !== E2E_PASSPHRASE) unlockFailed();
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
  vault_lock: (_args, ctx) => {
    ctx.store.vaultState = ctx.store.vaultState === "absent" ? "absent" : "locked";
    return status(ctx.store);
  },
  vault_change_passphrase: (args, ctx) => {
    if (args.oldPassphrase !== E2E_PASSPHRASE) unlockFailed();
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
};
