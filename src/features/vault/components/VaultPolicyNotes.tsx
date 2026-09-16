import { Info } from "lucide-react";
import { useTranslation } from "@/i18n";

const POLICY_KEYS = ["vault.noteNoRemember", "vault.noteUnrecoverable", "vault.noteLimits"] as const;

/** 加密笔记的边界说明：必须让用户在启用前就看清楚代价，而不是事后才发现。 */
export function VaultPolicyNotes() {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1.5 rounded-md border border-border bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary">
      {POLICY_KEYS.map((key) => (
        <li key={key} className="flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0 text-text-tertiary" />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}
