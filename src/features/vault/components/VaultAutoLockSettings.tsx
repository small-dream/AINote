import { useUiStore, type VaultAutoLockMinutes } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";

const AUTO_LOCK_OPTIONS: ReadonlyArray<{ value: VaultAutoLockMinutes; key: TranslationKey }> = [
  { value: 0, key: "vault.autoLockNever" },
  { value: 30, key: "vault.autoLock30m" },
  { value: 60, key: "vault.autoLock1h" },
  { value: 120, key: "vault.autoLock2h" },
];

/** 空闲自动锁定设置：纯前端 UI 偏好（localStorage），与主题等偏好一致。 */
export function VaultAutoLockSettings() {
  const { t } = useTranslation();
  const value = useUiStore((state) => state.vaultAutoLock);
  const setValue = useUiStore((state) => state.setVaultAutoLock);
  return (
    <section className="rounded-md border border-border p-3">
      <h3 className="text-sm font-medium text-text-primary">{t("vault.autoLockTitle")}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.autoLockDescription")}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("vault.autoLockTitle")}>
        {AUTO_LOCK_OPTIONS.map(({ value: option, key }) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setValue(option)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              {t(key)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
