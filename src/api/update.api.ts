import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body: string | null;
  date: string | null;
  currentVersion: string;
}

export interface UpdateProgress {
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export type UpdateInstallEvent =
  | { phase: "downloading"; progress: UpdateProgress }
  | { phase: "preparingInstall" };

let pendingUpdate: Update | null = null;

function parseProgress(receivedBytes: number, totalBytes: number | null): UpdateProgress {
  return {
    receivedBytes,
    totalBytes,
    percent: totalBytes ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : null,
  };
}

async function closePendingUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  await pendingUpdate.close();
  pendingUpdate = null;
}

/** 读取应用自身版本，供更新页在检查前展示当前状态。 */
async function getCurrentVersion(): Promise<string> {
  return getVersion();
}

/** 检查 GitHub Releases 是否有已签名的新版本。更新对象只保存在内存。 */
async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (pendingUpdate && pendingUpdate !== update) await closePendingUpdate();
  pendingUpdate = update;
  if (!update) return null;
  return {
    version: update.version,
    body: update.body ?? null,
    date: update.date ?? null,
    currentVersion: update.currentVersion,
  };
}

/** 下载、校验签名、安装并重启应用；进度事件只传递给更新页。 */
async function installUpdate(onEvent?: (event: UpdateInstallEvent) => void): Promise<void> {
  if (!pendingUpdate) throw new Error("UPDATE_INSTALL_UNAVAILABLE");
  let receivedBytes = 0;
  let totalBytes: number | null = null;

  await pendingUpdate.downloadAndInstall((event) => {
    if (event.event === "Started") {
      receivedBytes = 0;
      totalBytes = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      receivedBytes += event.data.chunkLength;
    }

    if (event.event !== "Finished" && onEvent) {
      onEvent({ phase: "downloading", progress: parseProgress(receivedBytes, totalBytes) });
    }
  });

  await closePendingUpdate();
  onEvent?.({ phase: "preparingInstall" });
  await relaunch();
}

export const updateApi = { getCurrentVersion, checkForUpdate, installUpdate };
