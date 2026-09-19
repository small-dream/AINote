import { useTranslation } from "@/i18n";
import { isAndroidApp, isMobileApp } from "@/platform/runtime";
import { useUpdate } from "../hooks/useUpdate";
import { MobileUpdateSettings } from "./MobileUpdateSettings";
import { UpdateProgressBar } from "./UpdateProgressBar";
import { UpdateReleaseCard } from "./UpdateReleaseCard";
import { UpdateStatusCard } from "./UpdateStatusCard";

/** 设置页更新内容区：按平台分流——桌面走签名更新通道，Android 应用内下载 APK，iOS 走 App Store。 */
export function UpdateSettings() {
  if (!isMobileApp()) return <DesktopUpdateSettings />;
  return isAndroidApp() ? <MobileUpdateSettings /> : <IosUpdateSettings />;
}

/** iOS 更新内容区：updater 插件只在桌面注册，iOS 更新一律走 App Store。 */
function IosUpdateSettings() {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-border bg-bg-primary p-4">
      <p className="text-sm leading-6 text-text-secondary">{t("update.iosAppStoreHint")}</p>
    </section>
  );
}

/** 桌面更新内容区：展示当前状态、发布说明、下载进度和失败恢复入口。 */
function DesktopUpdateSettings() {
  const update = useUpdate();

  return (
    <div className="space-y-4">
      <UpdateStatusCard
        phase={update.phase}
        info={update.info}
        currentVersion={update.currentVersion}
        checkedAt={update.checkedAt}
        error={update.error}
        onCheck={update.checkForUpdate}
        onInstall={update.install}
      />

      {(update.phase === "downloading" || update.phase === "preparingInstall") && (
        <section className="rounded-lg border border-border bg-bg-primary p-4">
          <UpdateProgressBar progress={update.progress} />
        </section>
      )}

      {update.info && <UpdateReleaseCard info={update.info} />}
    </div>
  );
}
