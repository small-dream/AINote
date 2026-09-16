import { create } from "zustand";
import type { UpdateInfo, UpdateProgress } from "@/api/update.api";

/** 桌面端更新阶段（设置页与升级弹窗共用同一状态）。 */
export type DesktopUpdatePhase =
  | "initializing"
  | "ready"
  | "checking"
  | "upToDate"
  | "readyToInstall"
  | "downloading"
  | "preparingInstall"
  | "error";

const DISMISSED_VERSION_KEY = "ainote.desktop-update.dismissed";

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

interface DesktopUpdateSnapshot {
  phase: DesktopUpdatePhase;
  currentVersion: string | null;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  checkedAt: Date | null;
  /** 设置页展示的失败原因（检查/安装失败共用）。 */
  error: string | null;
  /** 升级弹窗展示的安装失败原因；null 表示不存在安装失败。 */
  installError: string | null;
}

interface DesktopUpdateState extends DesktopUpdateSnapshot {
  /** 用户已忽略的版本（本机持久化，避免同一版本反复打扰）。 */
  dismissedVersion: string | null;
  /** 本次会话内已「稍后再说」的版本。 */
  snoozedVersion: string | null;
  report: (snapshot: Partial<DesktopUpdateSnapshot>) => void;
  dismiss: (version: string) => void;
  snooze: (version: string) => void;
}

export const INITIAL_DESKTOP_UPDATE_STATE: DesktopUpdateSnapshot = {
  phase: "initializing",
  currentVersion: null,
  info: null,
  progress: null,
  checkedAt: null,
  error: null,
  installError: null,
};

/**
 * 桌面端更新状态：设置页与升级弹窗共用，避免各自请求造成重复与状态分叉；
 * 「忽略此版本」按版本持久化，「稍后再说」仅本次会话生效。
 */
export const useDesktopUpdateStore = create<DesktopUpdateState>((set) => ({
  ...INITIAL_DESKTOP_UPDATE_STATE,
  dismissedVersion: readDismissedVersion(),
  snoozedVersion: null,
  report: (snapshot) => set(snapshot),
  dismiss: (version) => {
    persistDismissedVersion(version);
    set({ dismissedVersion: version });
  },
  snooze: (version) => set({ snoozedVersion: version }),
}));
