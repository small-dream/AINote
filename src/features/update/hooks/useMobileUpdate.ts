import { useCallback, useEffect } from "react";
import { mobileUpdateApi, recordMetric, releaseApi } from "@/api";
import { reportFrontendError } from "@/features/support/error-report";
import { isAndroidApp } from "@/platform/runtime";
import { useMobileUpdateStore } from "../stores/mobile-update.store";
import { isNewerVersion } from "../utils/version";

/** 同一时刻只允许一次检查（弹窗与设置页可能同时挂载）。 */
let inFlight: Promise<void> | null = null;

async function checkLatestRelease(): Promise<void> {
  const store = useMobileUpdateStore.getState();
  if (store.phase === "checking") return;
  store.report({ phase: "checking", currentVersion: store.currentVersion, release: null });
  recordMetric("update_checked");

  try {
    const release = await releaseApi.fetchLatestRelease();
    const available = isNewerVersion(release.version, release.currentVersion);
    useMobileUpdateStore.getState().report({
      phase: available ? "available" : "upToDate",
      currentVersion: release.currentVersion,
      release: available ? release : null,
    });
  } catch (error) {
    // 无网络或接口异常一律静默降级，不打扰用户；原因写入本地日志便于诊断
    reportFrontendError(error, "mobile-update-check");
    useMobileUpdateStore.getState().report({ phase: "failed", currentVersion: null, release: null });
  }
}

function requestCheck(): Promise<void> {
  inFlight ??= checkLatestRelease().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** 调起系统安装器；缺安装权限时由系统设置页引导用户授权。 */
async function installApk(path: string): Promise<void> {
  const { needsPermission } = await mobileUpdateApi.installApk(path);
  useMobileUpdateStore.getState().reportInstallInvoked(needsPermission);
}

/** 应用内下载 APK 并校验，成功后自动调起系统安装器；取消时回到「有新版本」。 */
async function downloadAndInstall(): Promise<void> {
  const store = useMobileUpdateStore.getState();
  const release = store.release;
  if (!release?.apkUrl || !release.apkSha256Url || store.phase === "downloading") return;

  store.beginDownload();
  let result: Awaited<ReturnType<typeof mobileUpdateApi.downloadUpdate>>;
  try {
    result = await mobileUpdateApi.downloadUpdate(
      { url: release.apkUrl, sha256Url: release.apkSha256Url, version: release.version },
      (progress) => useMobileUpdateStore.getState().reportProgress(progress),
    );
  } catch (error) {
    reportFrontendError(error, "mobile-update-download");
    useMobileUpdateStore.getState().reportDownloadFailed();
    return;
  }
  if (!result) {
    useMobileUpdateStore.getState().resetDownload();
    return;
  }
  useMobileUpdateStore.getState().reportDownloaded(result.path);
  // 安装调起失败与下载失败分开：安装失败保留已下载的 APK，用户可直接重试
  try {
    await installApk(result.path);
  } catch (error) {
    reportFrontendError(error, "mobile-update-install");
    useMobileUpdateStore.getState().reportInstallFailed();
  }
}

/** 移动端更新：自动检查 + 应用内下载安装编排。 */
export function useMobileUpdate() {
  const state = useMobileUpdateStore();
  const check = useCallback(() => requestCheck(), []);
  const download = useCallback(() => downloadAndInstall(), []);
  const cancelDownload = useCallback(() => {
    void mobileUpdateApi.cancelUpdateDownload();
  }, []);
  const reopenInstaller = useCallback(async () => {
    const { apkPath } = useMobileUpdateStore.getState();
    if (!apkPath) return;
    try {
      await installApk(apkPath);
    } catch (error) {
      reportFrontendError(error, "mobile-update-install");
      useMobileUpdateStore.getState().reportInstallFailed();
    }
  }, []);

  useEffect(() => {
    if (isAndroidApp()) void requestCheck();
  }, []);

  return { ...state, check, download, cancelDownload, reopenInstaller };
}
