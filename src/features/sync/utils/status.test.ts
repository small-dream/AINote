import { describe, expect, it } from "vitest";
import type { AppError } from "@/api/error";
import type { SyncStatus } from "@/api/types";
import { deriveSyncFailure, deriveSyncLabel, syncStageOf } from "./status";

function status(partial: Partial<SyncStatus>): SyncStatus {
  return { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false, ...partial };
}

describe("deriveSyncLabel", () => {
  it("冲突优先", () => {
    const label = deriveSyncLabel(status({ conflicted: true, ahead: 3 }), true);
    expect(label).toEqual({ text: "存在冲突", tone: "conflict" });
  });

  it("离线且有未同步内容", () => {
    const label = deriveSyncLabel(status({ ahead: 1, hasUncommitted: true }), false);
    expect(label).toEqual({ text: "离线待同步", tone: "offline" });
  });

  it("离线且无未同步内容", () => {
    expect(deriveSyncLabel(status({}), false)).toEqual({ text: "离线", tone: "offline" });
  });

  it("待推送", () => {
    expect(deriveSyncLabel(status({ ahead: 2 }), true)).toEqual({
      text: "待推送 2 个提交",
      tone: "pending",
    });
  });

  it("已同步", () => {
    expect(deriveSyncLabel(status({}), true)).toEqual({ text: "已同步", tone: "synced" });
  });
});

const appError = (code: string, message: string, retriable = true) => ({
  code,
  kind: "network" as const,
  message,
  retriable,
});

/** 带后端同步上下文的错误（E4-T4）：stage / files / hint 由 Rust 侧下发，前端不得推翻。 */
const syncError = (code: string, overrides: Partial<AppError> = {}): AppError => ({
  ...appError(code, "boom"),
  ...overrides,
});

describe("syncStageOf", () => {
  it("远端拒绝只可能发生在推送阶段", () => {
    expect(syncStageOf("SYNC_4004")).toBe("push");
  });

  it("网络与凭证错误落在网络阶段", () => {
    expect(syncStageOf("SYNC_4002")).toBe("remote");
    expect(syncStageOf("SYNC_4003")).toBe("remote");
    expect(syncStageOf("AUTH_2001")).toBe("remote");
  });

  it("本地错误落在提交阶段", () => {
    expect(syncStageOf("GIT_4001")).toBe("commit");
    expect(syncStageOf("IO_5001")).toBe("commit");
    expect(syncStageOf("NOTE_1001")).toBe("commit");
  });

  it("未知错误码回落到通用同步阶段", () => {
    expect(syncStageOf("")).toBe("sync");
    expect(syncStageOf("REPO_3001")).toBe("sync");
  });
});

describe("deriveSyncFailure", () => {
  it("无错误时不产生失败态", () => {
    expect(deriveSyncFailure(null)).toBeNull();
    expect(deriveSyncFailure(undefined)).toBeNull();
  });

  it("网络失败：阶段 + 原因 + 可重试建议", () => {
    expect(deriveSyncFailure(appError("SYNC_4002", "连接超时"))).toEqual({
      title: "同步失败",
      stage: "拉取 / 推送",
      reason: "连接超时",
      suggestion: "网络连接异常，请检查网络后重试",
      files: [],
      action: "retry",
      retriable: true,
    });
  });

  it("凭证失效引导重新登录", () => {
    const failure = deriveSyncFailure(appError("SYNC_4003", "401", false));
    expect(failure?.action).toBe("relogin");
    expect(failure?.stage).toBe("拉取 / 推送");
    expect(failure?.suggestion).toBe("登录凭证已失效，请重新登录 GitHub");
  });

  it("远端拒绝落到推送阶段并提示权限", () => {
    const failure = deriveSyncFailure(appError("SYNC_4004", "non-fast-forward", false));
    expect(failure?.stage).toBe("推送");
    expect(failure?.suggestion).toBe("远端拒绝本次操作，请检查仓库权限或先拉取远端更新");
  });

  it("本地提交失败落到提交阶段并给出通用建议", () => {
    const failure = deriveSyncFailure(appError("GIT_4001", "commit failed"));
    expect(failure?.stage).toBe("本地提交");
    expect(failure?.suggestion).toBe("请重试；若持续失败，请导出诊断包随反馈提交");
  });

  it("非 AppError 也给出可操作文案", () => {
    const failure = deriveSyncFailure(new Error("boom"));
    expect(failure?.reason).toBe("boom");
    expect(failure?.action).toBe("retry");
  });
});

describe("deriveSyncFailure / 后端同步上下文（E4-T4）", () => {
  it("后端 stage 优先于错误码推断", () => {
    const failure = deriveSyncFailure(syncError("SYNC_4002", { stage: "commit" }));
    expect(failure?.stage).toBe("本地提交");
  });

  it("后端 hint 优先于错误码推断", () => {
    const failure = deriveSyncFailure(syncError("SYNC_4002", { hint: "relogin" }));
    expect(failure?.suggestion).toBe("登录凭证已失效，请重新登录 GitHub");
  });

  it("hint 为 retry 时保留错误码给出的具体建议", () => {
    const failure = deriveSyncFailure(syncError("SYNC_4004", { hint: "retry" }));
    expect(failure?.suggestion).toBe("远端拒绝本次操作，请检查仓库权限或先拉取远端更新");
  });

  it("冲突建议码给出解决冲突文案", () => {
    const failure = deriveSyncFailure(syncError("SYNC_4001", { hint: "resolveConflicts" }));
    expect(failure?.suggestion).toBe("存在未解决的合并冲突，请先解决冲突再同步");
  });

  it("失败文件透传给 UI", () => {
    const failure = deriveSyncFailure(
      syncError("SYNC_4001", { stage: "pull", files: ["daily/a.md", "daily/b.md"] }),
    );
    expect(failure?.stage).toBe("拉取");
    expect(failure?.files).toEqual(["daily/a.md", "daily/b.md"]);
  });

  it("无上下文时失败文件为空数组", () => {
    expect(deriveSyncFailure(appError("SYNC_4002", "连接超时"))?.files).toEqual([]);
  });
});
