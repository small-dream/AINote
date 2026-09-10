import { beforeEach, describe, expect, it } from "vitest";
import { reportSyncProgress, useSyncRetryStore } from "./sync-retry.store";

describe("sync-retry.store", () => {
  beforeEach(() => {
    useSyncRetryStore.getState().clear();
  });

  it("初始没有重试进度", () => {
    expect(useSyncRetryStore.getState().progress).toBeNull();
  });

  it("IPC 进度事件映射为「第 n/m 次重试 + 等待毫秒」", () => {
    reportSyncProgress({ phase: "retrying", retry: 2, maxRetries: 3, delayMs: 1500 });
    expect(useSyncRetryStore.getState().progress).toEqual({
      retry: 2,
      maxRetries: 3,
      delayMs: 1500,
    });
  });

  it("清空后回到无重试状态", () => {
    reportSyncProgress({ phase: "retrying", retry: 1, maxRetries: 3, delayMs: 500 });
    useSyncRetryStore.getState().clear();
    expect(useSyncRetryStore.getState().progress).toBeNull();
  });
});
