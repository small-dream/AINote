import type { SyncStatus } from "@/api/types";
import { errorActionOf, isAppError, messageOf, type ErrorAction } from "@/api/error";
import { translate } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
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

/** 同步失败发生在哪一段（后端补齐 stage 之前由错误码推断） */
export type SyncFailureStage = "commit" | "remote" | "push" | "sync";

export interface SyncFailureState {
  title: string;
  stage: string;
  reason: string;
  suggestion: string;
  action: ErrorAction | null;
  retriable: boolean;
}

const STAGE_KEY: Record<SyncFailureStage, TranslationKey> = {
  commit: "sync.stageCommit",
  remote: "sync.stageRemote",
  push: "sync.stagePush",
  sync: "sync.stageSync",
};

/**
 * 由错误码推断失败阶段：`commit → pull → push` 中只有 push 会产生「远端拒绝」，
 * 网络/凭证错误发生在网络阶段（拉取或推送），本地错误则落在提交阶段。
 */
export function syncStageOf(code: string): SyncFailureStage {
  if (code === "SYNC_4004") return "push";
  if (code === "SYNC_4002" || code === "SYNC_4003" || code.startsWith("AUTH_")) return "remote";
  if (code.startsWith("GIT_") || code.startsWith("IO_") || code.startsWith("NOTE_")) return "commit";
  return "sync";
}

function suggestionKeyOf(code: string): TranslationKey {
  switch (code) {
    case "SYNC_4001":
      return "sync.failedConflict";
    case "SYNC_4002":
      return "error.sync.network";
    case "SYNC_4003":
      return "error.sync.auth";
    case "SYNC_4004":
      return "error.sync.permission";
    default:
      return "sync.failedGeneric";
  }
}

/** 把同步失败翻译成「阶段 + 原因 + 下一步动作」；无错误时返回 null（纯函数）。 */
export function deriveSyncFailure(error: unknown, locale: Locale = "zh-CN"): SyncFailureState | null {
  if (!error) return null;
  const appError = isAppError(error) ? error : null;
  const code = appError?.code ?? "";
  return {
    title: translate(locale, "sync.failedTitle"),
    stage: translate(locale, STAGE_KEY[syncStageOf(code)]),
    reason: messageOf(error),
    suggestion: translate(locale, suggestionKeyOf(code)),
    action: appError ? errorActionOf(appError) : "retry",
    retriable: appError ? appError.retriable : true,
  };
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
