import { TriangleAlert } from "lucide-react";
import type { UpdateInfo, UpdateProgress } from "@/api/update.api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { useDesktopUpdatePrompt } from "../hooks/useDesktopUpdatePrompt";
import { extractReleaseNotes } from "../utils/releaseNotes";
import { UpdateProgressBar } from "./UpdateProgressBar";
import { UpdateReleaseNotes } from "./UpdateReleaseNotes";

/** 桌面端升级弹窗：启动检查发现新版本时主动提示，下载 / 安装 / 失败全程可见。 */
export function DesktopUpdateDialog() {
  const { t } = useTranslation();
  const prompt = useDesktopUpdatePrompt();
  const info = prompt.info;

  if (!prompt.visible || !info) return null;

  const onClose = prompt.activeInstall ? () => undefined : prompt.snooze;

  return (
    <Modal open title={t("update.found", { version: info.version })} onClose={onClose} mobileSheet={false}>
      {prompt.installFailed ? (
        <FailedBody
          message={prompt.installError ?? t("update.installFailed")}
          onRetry={() => void prompt.install()}
          onLater={prompt.snooze}
        />
      ) : prompt.activeInstall ? (
        <InstallingBody progress={prompt.progress} />
      ) : (
        <AvailableBody
          info={info}
          currentVersion={prompt.currentVersion}
          onInstall={() => void prompt.install()}
          onLater={prompt.snooze}
          onDismiss={prompt.dismiss}
        />
      )}
    </Modal>
  );
}

function AvailableBody({
  info,
  currentVersion,
  onInstall,
  onLater,
  onDismiss,
}: {
  info: UpdateInfo;
  currentVersion: string | null;
  onInstall: () => void;
  onLater: () => void;
  onDismiss: () => void;
}) {
  const { t, locale } = useTranslation();
  const notes = extractReleaseNotes(info.body, locale);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-text-secondary">{t("update.desktopPrompt")}</p>
      <p className="text-sm text-text-primary">
        {t("update.desktopVersionLine", { current: currentVersion ?? "—", version: info.version })}
      </p>
      {notes && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-bg-secondary p-3">
          <UpdateReleaseNotes content={notes} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="border border-border text-xs" onClick={onDismiss}>
          {t("update.desktopDismiss")}
        </Button>
        <Button variant="ghost" className="border border-border text-xs" onClick={onLater}>
          {t("update.desktopLater")}
        </Button>
        <Button onClick={onInstall}>{t("update.install", { version: info.version })}</Button>
      </div>
    </div>
  );
}

function InstallingBody({ progress }: { progress: UpdateProgress | null }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-text-secondary">{t("update.desktopInstallingNote")}</p>
      <UpdateProgressBar progress={progress} />
    </div>
  );
}

function FailedBody({ message, onRetry, onLater }: { message: string; onRetry: () => void; onLater: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
        <p className="text-sm leading-6 text-text-secondary">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="border border-border text-xs" onClick={onLater}>
          {t("update.desktopLater")}
        </Button>
        <Button onClick={onRetry}>{t("common.retry")}</Button>
      </div>
    </div>
  );
}
