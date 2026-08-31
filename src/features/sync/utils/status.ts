import type { SyncStatus } from "@/api/types";
import { translate } from "@/i18n";
import type { Locale } from "@/stores/ui.store";

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
export function deriveSyncLabel(status: SyncStatus, online: boolean, locale: Locale = "zh-CN"): SyncLabel {
  if (status.conflicted) return { text: translate(locale, "sync.conflict"), tone: "conflict" };
  return online ? onlineLabel(status, locale) : offlineLabel(status, locale);
}

export function deriveSyncHeader(status: SyncStatus, online: boolean, operation: SyncOperation, locale: Locale = "zh-CN"): SyncHeaderState {
  const label = deriveSyncLabel(status, online, locale);
  if (!operation) {
    return {
      text: label.text,
      tone: label.tone,
      buttonLabel: translate(locale, "sync.now"),
      busy: false,
    };
  }

  const operationText = operation === "startup" ? translate(locale, "sync.starting") : operation === "syncing" ? translate(locale, "sync.syncing") : translate(locale, "sync.resolving");
  return {
    text: operationText,
    tone: "pending",
    buttonLabel: operation === "startup" ? translate(locale, "sync.starting") : translate(locale, "sync.syncing"),
    busy: true,
  };
}

function offlineLabel(status: SyncStatus, locale: Locale): SyncLabel {
  if (status.ahead > 0 || status.hasUncommitted) return { text: translate(locale, "sync.offlinePending"), tone: "offline" };
  return { text: translate(locale, "sync.offline"), tone: "offline" };
}

function onlineLabel(status: SyncStatus, locale: Locale): SyncLabel {
  if (status.ahead > 0 && status.behind > 0) return { text: translate(locale, "sync.pushPull"), tone: "pending" };
  if (status.ahead > 0) return { text: translate(locale, "sync.push", { count: status.ahead }), tone: "pending" };
  if (status.behind > 0) return { text: translate(locale, "sync.pull", { count: status.behind }), tone: "pending" };
  if (status.hasUncommitted) return { text: translate(locale, "sync.unsaved"), tone: "pending" };
  return { text: translate(locale, "sync.synced"), tone: "synced" };
}
