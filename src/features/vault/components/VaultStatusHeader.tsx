import { Lock, LockOpen, ShieldCheck, type LucideIcon } from "lucide-react";
import type { VaultState } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";

const STATE_META: Record<VaultState, { icon: LucideIcon; labelKey: TranslationKey; tone: string }> = {
  absent: { icon: ShieldCheck, labelKey: "vault.stateAbsent", tone: "text-text-tertiary" },
  locked: { icon: Lock, labelKey: "vault.stateLocked", tone: "text-amber-500" },
  unlocked: { icon: LockOpen, labelKey: "vault.stateUnlocked", tone: "text-accent" },
};

interface VaultStatusHeaderProps {
  state: VaultState;
  count: number;
}

/** 加密状态卡片：状态 + 已加密笔记数量。 */
export function VaultStatusHeader({ state, count }: VaultStatusHeaderProps) {
  const { t } = useTranslation();
  const { icon: Icon, labelKey, tone } = STATE_META[state];
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-bg-secondary px-3 py-2.5">
      <Icon size={18} className={`mt-0.5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{t(labelKey)}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{t("vault.encryptedCount", { count })}</p>
      </div>
    </div>
  );
}
