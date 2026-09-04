import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useUiStore, type NoteThemeScope, type Theme } from "@/stores/ui.store";
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
  const noteThemeScope = useUiStore((s) => s.noteThemeScope);
  const setNoteThemeScope = useUiStore((s) => s.setNoteThemeScope);
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
      <NoteThemeScopeSettings value={noteThemeScope} onChange={setNoteThemeScope} />
      <TypographySettings />
    </div>
  );
}

function NoteThemeScopeSettings({ value, onChange }: { value: NoteThemeScope; onChange: (value: NoteThemeScope) => void }) {
  const { t } = useTranslation();
  const options: ReadonlyArray<{ value: NoteThemeScope; label: string; description: string }> = [
    { value: "workspace", label: t("settings.noteThemeScopeWorkspace"), description: t("settings.noteThemeScopeWorkspaceHint") },
    { value: "content", label: t("settings.noteThemeScopeContent"), description: t("settings.noteThemeScopeContentHint") },
  ];
  return (
    <section>
      <h3 className="mb-1 text-sm font-medium text-text-primary">{t("settings.noteThemeScope")}</h3>
      <p className="mb-3 text-xs leading-5 text-text-tertiary">{t("settings.noteThemeScopeDescription")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("settings.noteThemeScope")}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-left transition-colors ${value === option.value ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs leading-5 opacity-80">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
