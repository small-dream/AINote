import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { buildStartupDigest, digestDateKey, msUntilNextLocalDay, DIGEST_TASK_LIMIT } from "./startupDigest";

function task(overrides: Partial<TaskItemDto>): TaskItemDto {
  return {
    id: "t-1",
    title: "任务",
    description: "",
    done: false,
    priority: "none",
    dueAt: null,
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

/** 2026-09-16 10:00 本地时间 */
const NOW = new Date(2026, 8, 16, 10, 0);

describe("buildStartupDigest", () => {
  it("没有待处理任务时返回 null", () => {
    expect(buildStartupDigest([], NOW)).toBeNull();
    expect(buildStartupDigest([task({ dueAt: "2026-09-20" })], NOW)).toBeNull();
    expect(buildStartupDigest([task({ dueAt: null })], NOW)).toBeNull();
  });

  it("已完成的任务不计入", () => {
    const digest = buildStartupDigest([
      task({ id: "done", done: true, dueAt: "2026-09-01" }),
      task({ id: "done-today", done: true, dueAt: "2026-09-16" }),
    ], NOW);
    expect(digest).toBeNull();
  });

  it("分开统计逾期与今天到期", () => {
    const digest = buildStartupDigest([
      task({ id: "old", title: "上周的", dueAt: "2026-09-10" }),
      task({ id: "today", title: "今天的", dueAt: "2026-09-16" }),
    ], NOW);
    expect(digest).toMatchObject({ overdueCount: 1, dueTodayCount: 1, total: 2, remaining: 0 });
  });

  it("只到天的今日任务算今天到期，今天已过时刻的算逾期", () => {
    const digest = buildStartupDigest([
      task({ id: "no-time", title: "只到天", dueAt: "2026-09-16" }),
      task({ id: "earlier", title: "早上九点", dueAt: "2026-09-16T09:00" }),
      task({ id: "later", title: "傍晚六点", dueAt: "2026-09-16T18:00" }),
    ], NOW);
    expect(digest).toMatchObject({ overdueCount: 1, dueTodayCount: 2, total: 3 });
    expect(digest?.items.map((item) => item.id)).toEqual(["earlier", "later", "no-time"]);
  });

  it("逾期优先，且最多列出 DIGEST_TASK_LIMIT 条", () => {
    const digest = buildStartupDigest([
      task({ id: "t1", dueAt: "2026-09-16T18:00" }),
      task({ id: "t2", dueAt: "2026-09-16T19:00" }),
      task({ id: "o1", dueAt: "2026-09-15" }),
      task({ id: "o2", dueAt: "2026-09-14" }),
    ], NOW);
    expect(digest).toMatchObject({ overdueCount: 2, dueTodayCount: 2, total: 4, remaining: 4 - DIGEST_TASK_LIMIT });
    expect(digest?.items.map((item) => item.id)).toEqual(["o2", "o1", "t1"]);
  });

  it("组内沿用待办列表的排序（截止升序 → 优先级 → 创建时间）", () => {
    const digest = buildStartupDigest([
      task({ id: "low", title: "低", priority: "low", dueAt: "2026-09-13" }),
      task({ id: "high", title: "高", priority: "high", dueAt: "2026-09-13" }),
    ], NOW);
    expect(digest?.items.map((item) => item.id)).toEqual(["high", "low"]);
  });
});

describe("digestDateKey", () => {
  it("按仓库与本地日期生成键", () => {
    expect(digestDateKey("/repo/a", NOW)).toBe("/repo/a@2026-09-16");
    expect(digestDateKey("/repo/b", NOW)).not.toBe(digestDateKey("/repo/a", NOW));
  });
});

describe("msUntilNextLocalDay", () => {
  it("指向下一个本地 00:00 之后的宽限期", () => {
    const noon = new Date(2026, 8, 16, 12, 0);
    expect(msUntilNextLocalDay(noon)).toBe(12 * 60 * 60 * 1000 + 10_000);
  });

  it("跨月也落在下一天", () => {
    const late = new Date(2026, 8, 30, 23, 59, 30);
    expect(msUntilNextLocalDay(late)).toBe(30_000 + 10_000);
  });
});
