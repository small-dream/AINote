import type { InputHTMLAttributes, ReactNode } from "react";

export const VAULT_INPUT_CLASS =
  "h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary transition-colors placeholder:text-text-secondary hover:border-text-tertiary focus:border-accent focus:outline-none";

interface VaultFieldProps {
  label: string;
  children: ReactNode;
}

export function VaultField({ label, children }: VaultFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

/** 口令输入框：始终 type=password，且不参与浏览器自动填充保存。 */
export function VaultPassphraseInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="password" autoComplete="new-password" spellCheck={false} {...props} className={`${VAULT_INPUT_CLASS} ${className}`} />;
}
