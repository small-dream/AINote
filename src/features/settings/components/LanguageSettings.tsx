import { Languages } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useUiStore, type Locale } from "@/stores/ui.store";

const LOCALE_OPTIONS: ReadonlyArray<{ value: Locale; key: "settings.chinese" | "settings.english" }> = [
  { value: "zh-CN", key: "settings.chinese" },
  { value: "en-US", key: "settings.english" },
];

/** 设置中的显示语言选择；偏好写入全局 UI 状态并持久化。 */
export function LanguageSettings() {
  const { t } = useTranslation();
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{t("settings.language")}</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("settings.language")}>
        {LOCALE_OPTIONS.map(({ value, key }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={locale === value}
            onClick={() => setLocale(value)}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              locale === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <Languages size={16} />
            {t(key)}
          </button>
        ))}
      </div>
    </section>
  );
}
