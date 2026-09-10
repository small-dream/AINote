import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { openExternal } from "@/api";
import type { ApkDownloadProgress } from "@/api/mobile-update.api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { useMobileUpdate } from "../hooks/useMobileUpdate";
import type { MobileUpdatePhase } from "../stores/mobile-update.store";
import { UpdateProgressBar } from "./UpdateProgressBar";

const ACTIVE_PHASES: readonly MobileUpdatePhase[] = [
  "available",
  "downloading",
  "installing",
  "downloadFailed",
];

/**
 * 移动端更新弹窗（E1-T5）：发现新版本时应用内下载 APK 并调起系统安装器，
 * 安装确认由系统完成；Release 缺少 APK 资产时降级为跳转下载页。
 * 「稍后再说」/ 返回键 / 遮罩点击只关闭本次会话；「忽略此版本」按版本持久化。
 */
export function MobileUpdateDialog() {
  const { t } = useTranslation();
  const state = useMobileUpdate();
  const [snoozedVersion, setSnoozedVersion] = useState<string | null>(null);
  const { phase, release, dismissedVersion, cancelDownload } = state;

  if (!ACTIVE_PHASES.includes(phase) || !release) return null;
  if (release.version === dismissedVersion || release.version === snoozedVersion) return null;

  const snooze = () => {
    if (phase === "downloading") cancelDownload();
    setSnoozedVersion(release.version);
  };

  return (
    <Modal
      open
      title={t("update.found", { version: release.version })}
      onClose={snooze}
      className="mx-4"
    >
      {phase === "downloading" ? (
        <DownloadingBody progress={state.progress} onCancel={cancelDownload} />
      ) : phase === "installing" ? (
        <InstallingBody
          needsPermission={state.installNeedsPermission}
          onReopen={() => void state.reopenInstaller()}
          onDone={snooze}
        />
      ) : phase === "downloadFailed" ? (
        <FailedBody onRetry={() => void state.download()} onLater={snooze} />
      ) : (
        <AvailableBody
          apkUrl={release.apkUrl}
          htmlUrl={release.htmlUrl}
          onDownload={() => void state.download()}
          onLater={snooze}
          onDismiss={() => state.dismiss(release.version)}
        />
      )}
    </Modal>
  );
}

function AvailableBody({ apkUrl, htmlUrl, onDownload, onLater, onDismiss }: { apkUrl: string | null; htmlUrl: string; onDownload: () => void; onLater: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="mb-5 text-sm text-text-secondary">{t("update.mobileManualHint")}</p>
      <div className="flex flex-col gap-2">
        {apkUrl ? (
          <Button variant="primary" className="inline-flex items-center justify-center gap-1.5" onClick={onDownload}>
            <Download size={15} aria-hidden="true" />
            {t("update.mobileInstallNow")}
          </Button>
        ) : (
          <Button variant="primary" className="inline-flex items-center justify-center gap-1.5" onClick={() => void openExternal(htmlUrl)}>
            <ExternalLink size={15} aria-hidden="true" />
            {t("update.mobileOpenRelease")}
          </Button>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onLater}>{t("update.mobileLater")}</Button>
          <Button variant="ghost" onClick={onDismiss}>{t("update.mobileDismiss")}</Button>
        </div>
      </div>
    </>
  );
}

function DownloadingBody({ progress, onCancel }: { progress: ApkDownloadProgress | null; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <UpdateProgressBar progress={progress} />
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel}>{t("update.cancelDownload")}</Button>
      </div>
    </div>
  );
}

function InstallingBody({ needsPermission, onReopen, onDone }: { needsPermission: boolean; onReopen: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t("update.mobileInstalling")}</p>
      {needsPermission ? (
        <p className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
          {t("update.mobileInstallPermissionHint")}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{t("update.mobileDone")}</Button>
        <Button variant="primary" onClick={onReopen}>{t("update.mobileReopenInstaller")}</Button>
      </div>
    </div>
  );
}

function FailedBody({ onRetry, onLater }: { onRetry: () => void; onLater: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="text-sm text-danger">{t("update.mobileDownloadFailed")}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onLater}>{t("update.mobileLater")}</Button>
        <Button variant="primary" onClick={onRetry}>{t("common.retry")}</Button>
      </div>
    </div>
  );
}
