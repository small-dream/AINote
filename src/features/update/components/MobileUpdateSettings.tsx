import { Download, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openExternal } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useMobileUpdate } from "../hooks/useMobileUpdate";
import type { MobileUpdatePhase } from "../stores/mobile-update.store";

const STATUS_COPY: Record<MobileUpdatePhase, { key: TranslationKey; icon: LucideIcon }> = {
  idle: { key: "update.mobileIdle", icon: RefreshCw },
  checking: { key: "update.checking", icon: LoaderCircle },
  upToDate: { key: "update.latest", icon: ShieldCheck },
  available: { key: "update.found", icon: Download },
  failed: { key: "update.mobileCheckFailed", icon: TriangleAlert },
};

/**
 * 设置页「软件更新」（Android）：检查 GitHub Release 新版本并跳转下载页。
 * 与桌面不同，移动端不做应用内下载安装，因此这里只有检查与跳转。
 */
export function MobileUpdateSettings() {
  const { t } = useTranslation();
  const { phase, currentVersion, release, check } = useMobileUpdate();
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
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            className="border border-border text-xs"
            disabled={phase === "checking"}
            onClick={() => void check()}
          >
            {phase === "checking" ? t("update.checking") : t("update.check")}
          </Button>
          {release ? (
            <Button
              variant="primary"
              className="inline-flex items-center gap-1.5 px-3 text-xs"
              onClick={() => void openExternal(release.htmlUrl)}
            >
              <ExternalLink size={13} aria-hidden="true" />
              {t("update.mobileOpenRelease")}
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-text-tertiary">
            {t("update.currentVersion")} {currentVersion ? `v${currentVersion}` : "—"}
          </span>
        </div>
      </section>
      <p className="text-xs leading-5 text-text-tertiary">{t("update.mobileManualHint")}</p>
    </div>
  );
}
