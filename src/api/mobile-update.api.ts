import { Channel } from "@tauri-apps/api/core";
import { call } from "./client";

/** 更新包下载进度（与 Rust UpdateDownloadProgressDto 同构；可被 UpdateProgressBar 复用）。 */
export interface ApkDownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

/** 下载完成后的 APK 信息。 */
export interface ApkDownloadResult {
  path: string;
}

/** 安装调起结果：needsPermission 为 true 表示用户需先到系统设置授权后重试。 */
export interface InstallApkResult {
  needsPermission: boolean;
}

interface DownloadUpdateArgs {
  url: string;
  sha256Url: string;
  version: string;
}

/** 应用内下载并校验 APK；用户中途取消时返回 null（不视为错误）。进度经 Channel 回传。 */
function downloadUpdate(
  args: DownloadUpdateArgs,
  onProgress: (progress: ApkDownloadProgress) => void,
): Promise<ApkDownloadResult | null> {
  const channel = new Channel<ApkDownloadProgress>();
  channel.onmessage = onProgress;
  return call<ApkDownloadResult | null>("download_update", {
    url: args.url,
    sha256Url: args.sha256Url,
    version: args.version,
    onEvent: channel,
  });
}

/** 请求取消进行中的下载；无任务时静默成功。 */
function cancelUpdateDownload(): Promise<void> {
  return call("cancel_update_download");
}

/** 调起系统安装器安装已下载的 APK。 */
function installApk(path: string): Promise<InstallApkResult> {
  return call<InstallApkResult>("install_update", { path });
}

export const mobileUpdateApi = { downloadUpdate, cancelUpdateDownload, installApk };
