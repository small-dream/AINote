import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body: string | null;
  currentVersion: string;
}

let pendingUpdate: Update | null = null;

/** 检查 GitHub Releases 是否有已签名的新版本。更新对象只保存在内存。 */
async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  pendingUpdate = update;
  if (!update) return null;
  return {
    version: update.version,
    body: update.body ?? null,
    currentVersion: update.currentVersion,
  };
}

/** 下载、校验签名、安装并重启应用。 */
async function installUpdate(): Promise<void> {
  if (!pendingUpdate) throw new Error("UPDATE_INSTALL_UNAVAILABLE");
  await pendingUpdate.downloadAndInstall();
  await pendingUpdate.close();
  pendingUpdate = null;
  await relaunch();
}

export const updateApi = { checkForUpdate, installUpdate };
