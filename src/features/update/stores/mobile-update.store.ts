import { create } from "zustand";
import type { ReleaseInfo } from "@/api/release.api";

export type MobileUpdatePhase = "idle" | "checking" | "upToDate" | "available" | "failed";

export interface MobileUpdateSnapshot {
  phase: MobileUpdatePhase;
  currentVersion: string | null;
  release: ReleaseInfo | null;
}

interface MobileUpdateState extends MobileUpdateSnapshot {
  /** 用户已忽略的版本（本机持久化，避免同一版本反复打扰） */
  dismissedVersion: string | null;
  report: (snapshot: MobileUpdateSnapshot) => void;
  dismiss: (version: string) => void;
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
 * 移动端更新检查结果：提示条与设置页共用同一份状态，
 * 避免两处各自请求 GitHub 造成重复与不一致。
 */
export const useMobileUpdateStore = create<MobileUpdateState>((set) => ({
  phase: "idle",
  currentVersion: null,
  release: null,
  dismissedVersion: readDismissedVersion(),
  report: (snapshot) => set(snapshot),
  dismiss: (version) => {
    persistDismissedVersion(version);
    set({ dismissedVersion: version });
  },
}));
