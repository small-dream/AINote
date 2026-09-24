import { useCallback, useEffect } from "react";
import { mobileUpdateApi, recordMetric, releaseApi } from "@/api";
import { reportFrontendError } from "@/features/support/error-report";
import { isAndroidApp } from "@/platform/runtime";
import { useMobileUpdateStore } from "../stores/mobile-update.store";
import { isNewerVersion } from "../utils/version";

/** 同一时刻只允许一次检查（弹窗与设置页可能同时挂载）。 */
let inFlight: Promise<void> | null = null;

/**
 * 下载代际：取消（或开始新一次下载）即 +1，迟到的下载结果据此丢弃。
 * 后端取消是异步的，可能正卡在阻塞的网络读写里，不能把 UI 挂在「下载中」等它返回。
 */
let downloadGeneration = 0;

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
    // 保留已知版本号：检查失败不代表版本信息失效，避免设置页闪现「—」
    useMobileUpdateStore.getState().report({
      phase: "failed",
      currentVersion: useMobileUpdateStore.getState().currentVersion,
      release: null,
    });
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

  const generation = ++downloadGeneration;
  store.beginDownload();
  let result: Awaited<ReturnType<typeof mobileUpdateApi.downloadUpdate>>;
  try {
    result = await mobileUpdateApi.downloadUpdate(
      { url: release.apkUrl, sha256Url: release.apkSha256Url, version: release.version },
      (progress) => useMobileUpdateStore.getState().reportProgress(progress),
    );
  } catch (error) {
    // 用户已取消：这次下载的失败不再打扰（后端稍后才察觉取消属于正常现象）
    if (generation !== downloadGeneration) return;
    reportFrontendError(error, "mobile-update-download");
    useMobileUpdateStore.getState().reportDownloadFailed();
    return;
  }
  // 用户已取消：丢弃这次结果，既不回到下载态也不调起安装器
  if (generation !== downloadGeneration) return;
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
  // 取消点即生效：先回「有新版本」让弹窗立刻可用，再通知后端停止（后端可能仍在阻塞调用里）
  const cancelDownload = useCallback(() => {
    downloadGeneration += 1;
    void mobileUpdateApi.cancelUpdateDownload().catch(() => undefined);
    useMobileUpdateStore.getState().resetDownload();
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
