import { Download, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openExternal } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useMobileUpdate } from "../hooks/useMobileUpdate";
import type { MobileUpdatePhase } from "../stores/mobile-update.store";
import { UpdateProgressBar } from "./UpdateProgressBar";

const STATUS_COPY: Record<MobileUpdatePhase, { key: TranslationKey; icon: LucideIcon }> = {
  idle: { key: "update.mobileIdle", icon: RefreshCw },
  checking: { key: "update.checking", icon: LoaderCircle },
  upToDate: { key: "update.latest", icon: ShieldCheck },
  available: { key: "update.found", icon: Download },
  downloading: { key: "update.downloading", icon: LoaderCircle },
  installing: { key: "update.mobileInstalling", icon: Download },
  downloadFailed: { key: "update.mobileDownloadFailed", icon: TriangleAlert },
  failed: { key: "update.mobileCheckFailed", icon: TriangleAlert },
};

/**
 * 设置页「软件更新」（Android）：检查 GitHub Release、应用内下载 APK 并调起系统安装器。
 * Release 缺少 APK 资产时降级为跳转浏览器下载页。
 */
export function MobileUpdateSettings() {
  const { t } = useTranslation();
  const { phase, currentVersion, release, progress, check, download, cancelDownload, reopenInstaller } =
    useMobileUpdate();
  const copy = STATUS_COPY[phase];
  const Icon = copy.icon;
  const status = phase === "available" && release
    ? t(copy.key, { version: release.version })
    : t(copy.key);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-bg-primary p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-secondary text-text-secondary">
            <Icon size={18} className={phase === "checking" ? "animate-spin" : undefined} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-text-primary">{t("update.title")}</h3>
            <p role="status" aria-live="polite" className="mt-1 text-sm leading-6 text-text-secondary">{status}</p>
          </div>
        </div>
        {phase === "downloading" ? (
          <div className="mt-3">
            <UpdateProgressBar progress={progress} />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            className="border border-border text-xs"
            disabled={phase === "checking" || phase === "downloading"}
            onClick={() => void check()}
          >
            {phase === "checking" ? t("update.checking") : t("update.check")}
          </Button>
          <UpdateAction
            phase={phase}
            apkUrl={release?.apkUrl ?? null}
            htmlUrl={release?.htmlUrl ?? null}
            onDownload={() => void download()}
            onCancel={cancelDownload}
            onReopen={() => void reopenInstaller()}
          />
          <span className="ml-auto text-xs text-text-tertiary">
            {t("update.currentVersion")} {currentVersion ? `v${currentVersion}` : "—"}
          </span>
        </div>
      </section>
      <p className="text-xs leading-5 text-text-tertiary">{t("update.mobileManualHint")}</p>
    </div>
  );
}

function UpdateAction({ phase, apkUrl, htmlUrl, onDownload, onCancel, onReopen }: { phase: MobileUpdatePhase; apkUrl: string | null; htmlUrl: string | null; onDownload: () => void; onCancel: () => void; onReopen: () => void }) {
  const { t } = useTranslation();
  if (phase === "downloading") {
    return (
      <Button variant="ghost" className="border border-border text-xs" onClick={onCancel}>
        {t("update.cancelDownload")}
      </Button>
    );
  }
  if (phase === "installing") {
    return (
      <Button variant="primary" className="px-3 text-xs" onClick={onReopen}>
        {t("update.mobileReopenInstaller")}
      </Button>
    );
  }
  if (phase === "downloadFailed") {
    return (
      <Button variant="primary" className="px-3 text-xs" onClick={onDownload}>
        {t("common.retry")}
      </Button>
    );
  }
  if (phase === "available" && apkUrl) {
    return (
      <Button variant="primary" className="inline-flex items-center gap-1.5 px-3 text-xs" onClick={onDownload}>
        <Download size={13} aria-hidden="true" />
        {t("update.mobileInstallNow")}
      </Button>
    );
  }
  if (phase === "available" && htmlUrl) {
    return (
      <Button variant="primary" className="inline-flex items-center gap-1.5 px-3 text-xs" onClick={() => void openExternal(htmlUrl)}>
        <ExternalLink size={13} aria-hidden="true" />
        {t("update.mobileOpenRelease")}
      </Button>
    );
  }
  return null;
}
