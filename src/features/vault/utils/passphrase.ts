import type { TranslationKey } from "@/i18n/messages";

/** 口令强度规则：与 Rust `domain::vault::check_passphrase_strength` 保持同一口径与判定顺序。 */
export const MIN_PASSPHRASE_CHARS = 6;

export type PassphraseIssue = "tooShort" | "matchesContext" | "numericOnly";

export const PASSPHRASE_ISSUE_KEYS = {
  tooShort: "vault.passphraseTooShort",
  matchesContext: "vault.passphraseMatchesContext",
  numericOnly: "vault.passphraseNumericOnly",
} as const satisfies Record<PassphraseIssue, TranslationKey>;

/**
 * 返回第一个不满足的规则；通过返回 null。
 * `context` 传入账号名/仓库名等不得直接复用的词（后端按仓库目录名同样校验一次）。
 */
export function passphraseIssue(passphrase: string, context: readonly string[] = []): PassphraseIssue | null {
  if ([...passphrase].length < MIN_PASSPHRASE_CHARS) return "tooShort";
  const lowered = passphrase.toLowerCase();
  const reused = context.some((item) => item.trim() !== "" && lowered === item.trim().toLowerCase());
  if (reused) return "matchesContext";
  if (/^[0-9]+$/.test(passphrase)) return "numericOnly";
  return null;
}

export function isStrongPassphrase(passphrase: string, context: readonly string[] = []): boolean {
  return passphraseIssue(passphrase, context) === null;
}
