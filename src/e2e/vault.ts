/** E2E mock：加密笔记命令。口令不派生真实密钥，但状态机、错误码与信封语义对齐 Rust `services/vault_service`。 */
import { isEnvelopeText, unwrapEnvelope, wrapEnvelope } from "./envelope";
import { markWorkspaceDirty, type DirtyTrackedStore } from "./dirty";
import { metaOf, needNote, type E2eNoteMap } from "./notes";
import type { E2eState, E2eVaultState } from "./types";
import { MIN_PASSPHRASE_CHARS, passphraseIssue, type PassphraseIssue } from "@/features/vault/utils/passphrase";
import { repoNameOf } from "@/features/vault/utils/repoName";

export interface VaultStore extends DirtyTrackedStore {
  vaultState: E2eVaultState;
  /** 当前口令（改口令后轮换；未建库为 null） */
  passphrase: string | null;
  notes: E2eNoteMap;
}

interface VaultCommandContext {
  state: E2eState;
  store: VaultStore;
}

type VaultCommandHandler = (args: Record<string, unknown>, ctx: VaultCommandContext) => unknown;

function vaultError(code: string, kind: string, message: string): never {
  throw { code, kind, message, retriable: false };
}

/** 与 Rust `domain/error.rs` 的 VAULT_9xxx 映射一致。 */
const vaultInvalid = (message: string): never => vaultError("VAULT_9004", "Unknown", message);
const unlockFailed = (): never => vaultError("VAULT_9002", "Auth", "vault unlock failed: 口令错误");
const vaultLocked = (): never => vaultError("VAULT_9001", "Permission", "加密笔记需要先解锁仓库密钥");

/** 与 Rust `check_passphrase_strength` 同一判定顺序与文案（前端 util 即其 TS 对照）。 */
const STRENGTH_MESSAGES: Record<PassphraseIssue, string> = {
  tooShort: `口令至少需要 ${MIN_PASSPHRASE_CHARS} 个字符`,
  matchesContext: "口令不能与邮箱、账号名或仓库名相同",
  numericOnly: "口令不能是纯数字",
};

function checkStrength(passphrase: string, repoPath: string): void {
  const issue = passphraseIssue(passphrase, [repoNameOf(repoPath)]);
  if (issue !== null) vaultInvalid(STRENGTH_MESSAGES[issue]);
}

/** encryptedNotes 由内容信封首行统计（与 Rust `count_encrypted_notes` 同口径），不再恒为 0。 */
function status(store: VaultStore) {
  const encryptedNotes = [...store.notes.values()].filter((note) => isEnvelopeText(note.content)).length;
  return { state: store.vaultState, encryptedNotes };
}

function requireVault(store: VaultStore): void {
  if (store.vaultState === "absent") vaultInvalid("该仓库尚未建库");
}

function setNoteEncryption(args: Record<string, unknown>, ctx: VaultCommandContext) {
  const path = String(args.path ?? "");
  const note = needNote(ctx.store.notes, path);
  const encrypted = args.encrypted === true;
  if (encrypted && ctx.store.vaultState === "absent") {
    vaultInvalid("该仓库尚未启用加密笔记，请先在设置中启用");
  }
  if (isEnvelopeText(note.content) === encrypted) return metaOf(path, note);
  if (ctx.store.vaultState !== "unlocked") vaultLocked();
  note.content = encrypted ? wrapEnvelope(note.content) : unwrapEnvelope(note.content);
  markWorkspaceDirty(ctx.store, path);
  return metaOf(path, note);
}

export const vaultCommandHandlers: Record<string, VaultCommandHandler> = {
  vault_status: (_args, ctx) => status(ctx.store),
  vault_create: (args, ctx) => {
    if (ctx.store.vaultState !== "absent") vaultInvalid("该仓库已存在加密配置，请直接解锁");
    const passphrase = String(args.passphrase ?? "");
    checkStrength(passphrase, ctx.state.repoPath);
    ctx.store.passphrase = passphrase;
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
  vault_unlock: (args, ctx) => {
    requireVault(ctx.store);
    if (args.passphrase !== ctx.store.passphrase) unlockFailed();
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
  vault_lock: (_args, ctx) => {
    ctx.store.vaultState = ctx.store.vaultState === "absent" ? "absent" : "locked";
    return status(ctx.store);
  },
  vault_change_passphrase: (args, ctx) => {
    requireVault(ctx.store);
    if (args.oldPassphrase !== ctx.store.passphrase) unlockFailed();
    const next = String(args.newPassphrase ?? "");
    checkStrength(next, ctx.state.repoPath);
    ctx.store.passphrase = next;
    ctx.store.vaultState = "unlocked";
    return status(ctx.store);
  },
  vault_set_note_encryption: setNoteEncryption,
};
