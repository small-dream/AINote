import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { isMobileApp } from "@/platform/runtime";
import { useQuickUnlockToggle } from "../hooks/useQuickUnlockToggle";
import { quickUnlockKindLabel, quickUnlockReasonText } from "../utils/quickUnlock";

interface VaultQuickUnlockCardProps {
  /** 仓库处于锁定态：区块仍要显示（否则用户会以为「设置里根本没有这个选项」），只是禁用开关。 */
  locked: boolean;
}

/**
 * 设备级快速解锁区块。只要有密钥库就恒定可见：
 * - 已解锁：可开关；
 * - 已锁定：禁用并提示先解锁；
 * - 平台 / 设备不支持：写明原因（桌面 Windows・Linux 不显示，避免噪音）。
 */
export function VaultQuickUnlockCard({ locked }: VaultQuickUnlockCardProps) {
  const { t } = useTranslation();
  const { quick, ready, pending, error, toggle } = useQuickUnlockToggle();

  if (!ready) return null;
  if (!quick.supported) {
    if (!isMobileApp()) return null;
    return (
      <section className="rounded-md border border-border p-3">
        <h3 className="text-sm font-medium text-text-primary">{t("vault.quickUnlockTitle")}</h3>
        <p className="mt-1 text-xs text-text-secondary" role="status">
          {t("vault.quickUnlockUnsupported", { reason: quickUnlockReasonText(quick.reason, t) })}
        </p>
      </section>
    );
  }

  const kind = quickUnlockKindLabel(quick.kind, t);
  return (
    <section className="rounded-md border border-border p-3">
      <h3 className="text-sm font-medium text-text-primary">{t("vault.quickUnlockTitle")}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.quickUnlockDescription")}</p>
      <p className="mt-2 text-xs text-text-tertiary">
        {locked
          ? t("vault.quickUnlockLockedHint")
          : quick.enabled
            ? t("vault.quickUnlockEnabled", { kind })
            : t("vault.quickUnlockStorageNote")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="border border-border"
          disabled={pending || locked}
          onClick={toggle}
        >
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
