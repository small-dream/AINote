import { useUiStore } from "@/stores/ui.store";
import { SETTINGS_SECTIONS } from "../settingsSections";
import { useTranslation } from "@/i18n";

/** 设置页左侧分类导航轨道；激活项由全局 UI 态驱动。 */
export function SettingsNav() {
  const { t } = useTranslation();
  const active = useUiStore((s) => s.settingsTab);
  const setTab = useUiStore((s) => s.setSettingsTab);
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-border bg-bg-secondary/80 p-3" aria-label={t("settings.sectionNav")}>
      {SETTINGS_SECTIONS.map(({ id, labelKey, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            <Icon size={16} />
            {t(labelKey)}
          </button>
        );
      })}
    </nav>
  );
}
