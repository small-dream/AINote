import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useQuickUnlockToggle } from "../hooks/useQuickUnlockToggle";
import { quickUnlockKindLabel } from "../utils/quickUnlock";

/**
 * 设备级快速解锁开关（只在已解锁态出现）。
 * 平台不支持时整块不渲染：Windows / Linux / Android 9 以下根本没有这个能力。
 */
export function VaultQuickUnlockCard() {
  const { t } = useTranslation();
  const { quick, pending, error, toggle } = useQuickUnlockToggle();

  if (!quick.supported) return null;
  const kind = quickUnlockKindLabel(quick.kind, t);

  return (
    <section className="rounded-md border border-border p-3">
      <h3 className="text-sm font-medium text-text-primary">{t("vault.quickUnlockTitle")}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.quickUnlockDescription")}</p>
      <p className="mt-2 text-xs text-text-tertiary">
        {quick.enabled ? t("vault.quickUnlockEnabled", { kind }) : t("vault.quickUnlockStorageNote")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" className="border border-border" disabled={pending} onClick={toggle}>
          {pending
            ? t("vault.quickUnlockPending")
            : quick.enabled
              ? t("vault.quickUnlockDisable")
              : t("vault.quickUnlockEnable")}
        </Button>
      </div>
      {error !== null && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
