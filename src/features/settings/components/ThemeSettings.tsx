import { Moon, Sun } from "lucide-react";
import { useUiStore, type Theme } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; key: "settings.light" | "settings.dark"; icon: typeof Sun }> = [
  { value: "light", key: "settings.light", icon: Sun },
  { value: "dark", key: "settings.dark", icon: Moon },
];

/** 设置页外观内容区：亮色 / 暗色主题切换（标题由设置视图统一提供） */
export function ThemeSettings() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("settings.theme")}>
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
  );
}
