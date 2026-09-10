import { Download, X } from "lucide-react";
import { openExternal } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useMobileUpdate } from "../hooks/useMobileUpdate";

/**
 * 移动端启动更新提示（E1-T5）：发现新版本时提示并跳转 Release 页面。
 * 仅提示不下载——Android 分发走 GitHub APK，安装由用户显式完成。
 */
export function MobileUpdateBanner() {
  const { t } = useTranslation();
  const { phase, release, dismissedVersion, dismiss } = useMobileUpdate();
  if (phase !== "available" || !release || release.version === dismissedVersion) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-accent/30 bg-accent/5 px-4 py-2.5"
    >
      <Download size={15} aria-hidden="true" className="shrink-0 text-accent" />
      <p className="min-w-0 flex-1 break-words text-xs text-text-secondary">
        {t("update.found", { version: release.version })} · {t("update.mobileManualHint")}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="primary"
          className="px-3 text-xs"
          onClick={() => void openExternal(release.htmlUrl)}
        >
          {t("update.mobileOpenRelease")}
        </Button>
        <button
          type="button"
          aria-label={t("update.mobileDismiss")}
          className="rounded p-1 text-text-tertiary transition-colors hover:text-text-secondary"
          onClick={() => dismiss(release.version)}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
