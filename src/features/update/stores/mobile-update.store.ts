import { create } from "zustand";
import type { ApkDownloadProgress } from "@/api/mobile-update.api";
import type { ReleaseInfo } from "@/api/release.api";

export type MobileUpdatePhase =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installing"
  | "downloadFailed"
  | "failed";

export interface MobileUpdateSnapshot {
  phase: MobileUpdatePhase;
  currentVersion: string | null;
  release: ReleaseInfo | null;
}

interface MobileUpdateState extends MobileUpdateSnapshot {
  /** 用户已忽略的版本（本机持久化，避免同一版本反复打扰） */
  dismissedVersion: string | null;
  /** 下载进度（downloading 阶段有效） */
  progress: ApkDownloadProgress | null;
  /** 已下载待安装的 APK 路径（installing 阶段有效） */
  apkPath: string | null;
  /** 调起安装时被系统要求先授权「安装未知应用」 */
  installNeedsPermission: boolean;
  report: (snapshot: MobileUpdateSnapshot) => void;
  dismiss: (version: string) => void;
  beginDownload: () => void;
  reportProgress: (progress: ApkDownloadProgress) => void;
  reportDownloaded: (apkPath: string) => void;
  reportDownloadFailed: () => void;
  setInstallNeedsPermission: (needed: boolean) => void;
  /** 取消下载或重试前复位：回到「有新版本」状态 */
  resetDownload: () => void;
}

const DISMISSED_VERSION_KEY = "ainote.mobile-update.dismissed";

/** 读取已忽略版本；localStorage 不可用时按「未忽略」处理。 */
export function readDismissedVersion(): string | null {
  try {
    return globalThis.localStorage?.getItem(DISMISSED_VERSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistDismissedVersion(version: string): void {
  try {
    globalThis.localStorage?.setItem(DISMISSED_VERSION_KEY, version);
  } catch {
    // 持久化失败只影响本次会话：仍按已忽略处理
  }
}

/**
 * 移动端更新状态：检查、下载、安装进度收敛在一处，
 * 弹窗与设置页共用同一份状态，避免各自请求 GitHub 造成重复与不一致。
 */
export const useMobileUpdateStore = create<MobileUpdateState>((set) => ({
  phase: "idle",
  currentVersion: null,
  release: null,
  dismissedVersion: readDismissedVersion(),
  progress: null,
  apkPath: null,
  installNeedsPermission: false,
  report: (snapshot) => set({ ...snapshot, progress: null, apkPath: null, installNeedsPermission: false }),
  dismiss: (version) => {
    persistDismissedVersion(version);
    set({ dismissedVersion: version });
  },
  beginDownload: () => set({ phase: "downloading", progress: null, apkPath: null }),
  reportProgress: (progress) => set({ progress }),
  reportDownloaded: (apkPath) => set({ phase: "installing", apkPath, progress: null }),
  reportDownloadFailed: () => set({ phase: "downloadFailed", progress: null }),
  setInstallNeedsPermission: (needed) => set({ installNeedsPermission: needed }),
  resetDownload: () =>
    set({ phase: "available", progress: null, apkPath: null, installNeedsPermission: false }),
}));
