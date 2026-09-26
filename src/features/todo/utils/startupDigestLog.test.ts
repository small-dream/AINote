import { describe, expect, it, vi } from "vitest";
import { digestDateKey } from "./startupDigest";
import {
  DIGEST_LOG_RETENTION_DAYS,
  hasPromptedDigest,
  markDigestPrompted,
  STARTUP_DIGEST_STORAGE_KEY,
} from "./startupDigestLog";

/** 2026-09-16 10:00 本地时间 */
const NOW = new Date(2026, 8, 16, 10, 0);
const KEY = digestDateKey("/repo/a", NOW);

function storedKeys(): string[] {
  return Object.keys(JSON.parse(localStorage.getItem(STARTUP_DIGEST_STORAGE_KEY) ?? "{}") as Record<string, string>);
}

describe("启动摘要提示记录", () => {
  it("记下之后能读到，未记过的返回 false", () => {
    expect(hasPromptedDigest(KEY)).toBe(false);
    markDigestPrompted(KEY, NOW);
    expect(hasPromptedDigest(KEY)).toBe(true);
    expect(JSON.parse(localStorage.getItem(STARTUP_DIGEST_STORAGE_KEY) ?? "{}")).toMatchObject({ [KEY]: NOW.toISOString() });
  });

  it("不同仓库、不同日期互不影响", () => {
    const other = digestDateKey("/repo/b", NOW);
    const tomorrow = digestDateKey("/repo/a", new Date(2026, 8, 17, 9, 0));
    markDigestPrompted(KEY, NOW);
    expect(hasPromptedDigest(other)).toBe(false);
    expect(hasPromptedDigest(tomorrow)).toBe(false);
  });

  it("重新加载模块（应用重启）后记录仍在", async () => {
    markDigestPrompted(KEY, NOW);
    vi.resetModules();
    const reloaded = await import("./startupDigestLog");
    expect(reloaded.hasPromptedDigest(KEY)).toBe(true);
  });

  it("写入时裁掉保留期之外的条目，保留期内与无法解析键的条目留下", () => {
    const stale = digestDateKey("/repo/a", new Date(2026, 8, 1));
    const cut = digestDateKey("/repo/a", new Date(2026, 8, 16 - DIGEST_LOG_RETENTION_DAYS));
    localStorage.setItem(STARTUP_DIGEST_STORAGE_KEY, JSON.stringify({
      [stale]: "2026-09-01T00:00:00.000Z",
      [cut]: "2026-09-09T00:00:00.000Z",
      legacy: "2026-09-01T00:00:00.000Z",
    }));

    markDigestPrompted(KEY, NOW);

    expect(storedKeys()).toEqual([cut, "legacy", KEY]);
  });

  it("落盘内容损坏时按空记录处理，不抛异常", () => {
    localStorage.setItem(STARTUP_DIGEST_STORAGE_KEY, "not-json");
    expect(hasPromptedDigest(KEY)).toBe(false);
    markDigestPrompted(KEY, NOW);
    expect(hasPromptedDigest(KEY)).toBe(true);
  });

  it("localStorage 不可用时降级为内存记录，不写盘", async () => {
    vi.resetModules();
    vi.doMock("@/stores/ui.store", () => ({ isLocalStorageAvailable: () => false }));
    try {
      const log = await import("./startupDigestLog");
      expect(log.hasPromptedDigest(KEY)).toBe(false);
      log.markDigestPrompted(KEY, NOW);
      expect(log.hasPromptedDigest(KEY)).toBe(true);
      expect(localStorage.getItem(STARTUP_DIGEST_STORAGE_KEY)).toBeNull();
    } finally {
      vi.doUnmock("@/stores/ui.store");
      vi.resetModules();
    }
  });
});
