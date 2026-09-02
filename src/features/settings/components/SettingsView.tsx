import { useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useUiStore } from "@/stores/ui.store";
import { SETTINGS_SECTIONS } from "../settingsSections";
import { SettingsNav } from "./SettingsNav";
import { useTranslation } from "@/i18n";

/** 全屏设置视图：左侧分类导航 + 右侧内容区，取代旧设置弹窗（参考 Obsidian / VS Code）。 */
export function SettingsView() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.settingsOpen);
  const tab = useUiStore((s) => s.settingsTab);
  const close = useUiStore((s) => s.closeSettings);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;
  const section = SETTINGS_SECTIONS.find((item) => item.id === tab);
  if (!section) return null;
  const Active = section.component;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg-primary" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div data-tauri-drag-region className="h-11 shrink-0" aria-hidden="true" />
      <SettingsHeader onClose={close} />
      <div className="flex min-h-0 flex-1">
        <SettingsNav />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg-primary">
          <div className="mx-auto w-full max-w-2xl px-6 py-8">
            <header className="mb-6">
              <h2 className="text-xl font-semibold text-text-primary">{t(section.labelKey)}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t(section.descriptionKey)}</p>
            </header>
            <Active />
          </div>
        </main>
      </div>
    </div>
  );
}

function SettingsHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("settings.back")}
        title={t("settings.back")}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={16} />
        {t("settings.back")}
      </button>
      <h1 id="settings-title" className="min-w-0 truncate text-base font-semibold text-text-primary">{t("settings.title")}</h1>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        title={t("common.close")}
        className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <X size={18} />
      </button>
    </header>
  );
}
