import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useUiStore, type Theme } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { NoteThemeGallery } from "./NoteThemeGallery";
import { TypographySettings } from "./TypographySettings";

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; key: "settings.light" | "settings.dark" | "settings.system"; icon: LucideIcon }> = [
  { value: "light", key: "settings.light", icon: Sun },
  { value: "dark", key: "settings.dark", icon: Moon },
  { value: "system", key: "settings.system", icon: Monitor },
];

/** 设置页外观内容区：应用主题（亮色 / 暗色 / 跟随系统）+ 阅读主题画廊 */
export function ThemeSettings() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-2 text-sm font-medium text-text-primary">{t("settings.theme")}</h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("settings.theme")}>
          {THEME_OPTIONS.map(({ value, key, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <Icon size={16} />
                {t(key)}
              </button>
            );
          })}
        </div>
      </section>
      <NoteThemeGallery />
      <TypographySettings />
    </div>
  );
}
