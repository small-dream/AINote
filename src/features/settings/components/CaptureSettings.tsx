import { Keyboard } from "lucide-react";
import { isMobileApp } from "@/platform/runtime";
import { useTranslation } from "@/i18n";
import { useCaptureSettings } from "@/features/capture/hooks/useCaptureSettings";
import { ShortcutControls } from "./ShortcutControls";

/** 设置 → 通用：快速捕捉快捷键录制、保存与恢复默认。 */
export function CaptureSettings() {
  const { t } = useTranslation();
  const settingsState = useCaptureSettings();
  if (isMobileApp()) {
    return <p className="rounded-lg border border-border bg-bg-secondary/60 p-4 text-sm text-text-secondary">{t("capture.mobileHint")}</p>;
  }
  return (
    <section className="space-y-4 rounded-lg border border-border bg-bg-secondary/40 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Keyboard size={15} className="text-accent" />{t("capture.shortcutTitle")}</h3>
        <p className="mt-1 text-xs text-text-secondary">{t("capture.shortcutDescription")}</p>
      </div>
      {settingsState.loading ? <p className="text-sm text-text-tertiary">{t("common.loading")}</p> : <ShortcutControls {...settingsState} />}
    </section>
  );
}
