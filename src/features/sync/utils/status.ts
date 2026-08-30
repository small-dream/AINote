import type { SyncStatus } from "@/api/types";

export type SyncTone = "synced" | "pending" | "conflict" | "offline";
export type SyncOperation = "startup" | "syncing" | "resolving" | null;

export interface SyncLabel {
  text: string;
  tone: SyncTone;
}

export interface SyncHeaderState {
  text: string;
  tone: SyncTone;
  buttonLabel: string;
  busy: boolean;
}

/** 由后端 SyncStatus + 联网状态推导 UI 文案与语义（纯函数，便于单测） */
export function deriveSyncLabel(status: SyncStatus, online: boolean): SyncLabel {
  if (status.conflicted) return { text: "存在冲突", tone: "conflict" };
  return online ? onlineLabel(status) : offlineLabel(status);
}

export function deriveSyncHeader(status: SyncStatus, online: boolean, operation: SyncOperation): SyncHeaderState {
  const label = deriveSyncLabel(status, online);
  if (!operation) {
    return {
      text: label.text,
      tone: label.tone,
      buttonLabel: "立即同步",
      busy: false,
    };
  }

  const operationText = operation === "startup" ? "初始化同步中…" : operation === "syncing" ? "同步中…" : "处理中…";
  return {
    text: operationText,
    tone: "pending",
    buttonLabel: operation === "startup" ? "初始化同步中…" : "同步中…",
    busy: true,
  };
}

function offlineLabel(status: SyncStatus): SyncLabel {
  if (status.ahead > 0 || status.hasUncommitted) return { text: "离线待同步", tone: "offline" };
  return { text: "离线", tone: "offline" };
}

function onlineLabel(status: SyncStatus): SyncLabel {
  if (status.ahead > 0 && status.behind > 0) return { text: "待推送且可拉取", tone: "pending" };
  if (status.ahead > 0) return { text: `待推送 ${status.ahead} 个提交`, tone: "pending" };
  if (status.behind > 0) return { text: `可拉取 ${status.behind} 个提交`, tone: "pending" };
  if (status.hasUncommitted) return { text: "有待保存变更", tone: "pending" };
  return { text: "已同步", tone: "synced" };
}
