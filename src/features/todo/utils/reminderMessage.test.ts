import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import {
  NOTICE_EXCERPT_LIMIT,
  reminderAlertOf,
  reminderDigestOf,
  reminderDueLabel,
  reminderExcerpt,
  reminderNoticeOf,
} from "./reminderMessage";

/** 2026-09-16 10:00 本地时间 */
const NOW = new Date(2026, 8, 16, 10, 0);

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "t1",
    title: "交周报",
    description: "",
    done: false,
    priority: "none",
    dueAt: "2026-09-16T18:00",
    remindAt: "2026-09-16T17:30",
    sortOrder: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("reminderExcerpt", () => {
  it("折叠换行与空白", () => {
    expect(reminderExcerpt("  第一条\n第二条  ")).toBe("第一条 第二条");
  });

  it("过长说明截断并加省略号", () => {
    const excerpt = reminderExcerpt("x".repeat(NOTICE_EXCERPT_LIMIT + 40));
    expect(excerpt).toHaveLength(NOTICE_EXCERPT_LIMIT + 1);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("空说明返回 null", () => {
    expect(reminderExcerpt("   \n ")).toBeNull();
  });
});

describe("reminderDueLabel", () => {
  it("今天 / 明天 / 后天用相对文案，带时刻时拼上时间", () => {
    expect(reminderDueLabel(task(), "zh-CN", NOW)).toBe("今天 18:00");
    expect(reminderDueLabel(task({ dueAt: "2026-09-17T09:00" }), "zh-CN", NOW)).toBe("明天 09:00");
    expect(reminderDueLabel(task({ dueAt: "2026-09-18" }), "zh-CN", NOW)).toBe("后天");
  });

  it("更远的日期显示月-日", () => {
    expect(reminderDueLabel(task({ dueAt: "2026-10-08T18:00" }), "zh-CN", NOW)).toBe("10-08 18:00");
  });

  it("跨年日期补上完整年份", () => {
    expect(reminderDueLabel(task({ dueAt: "2027-01-15" }), "zh-CN", NOW)).toBe("2027-01-15");
  });

  it("无截止时间返回 null", () => {
    expect(reminderDueLabel(task({ dueAt: null }), "zh-CN", NOW)).toBeNull();
  });
});

describe("reminderNoticeOf", () => {
  it("标题带任务名，正文带截止与优先级，长文本放说明", () => {
    const notice = reminderNoticeOf(task({ priority: "high", description: "整理成本周进展三条" }), "zh-CN", NOW);
    expect(notice.title).toBe("任务提醒：交周报");
    expect(notice.body).toBe("截止 今天 18:00 · 高优先级");
    expect(notice.detail).toBe("整理成本周进展三条");
  });

  it("无优先级时正文只留截止时间", () => {
    expect(reminderNoticeOf(task(), "zh-CN", NOW).body).toBe("截止 今天 18:00");
  });

  it("已过截止时刻改用逾期标题", () => {
    const notice = reminderNoticeOf(task({ dueAt: "2026-09-15T18:00" }), "zh-CN", NOW);
    expect(notice.title).toBe("已逾期：交周报");
  });

  it("英文文案同样带上截止与优先级", () => {
    const notice = reminderNoticeOf(task({ priority: "low" }), "en-US", NOW);
    expect(notice.title).toBe("Reminder: 交周报");
    expect(notice.body).toBe("due Today 18:00 · Low priority");
  });
});

describe("reminderDigestOf", () => {
  it("多条提醒合并成一条摘要，逐条列出且最多 5 行", () => {
    const tasks = Array.from({ length: 6 }, (_, index) => task({ id: `t${index}`, title: `任务${index}` }));
    const digest = reminderDigestOf(tasks, "zh-CN", NOW);
    expect(digest.title).toBe("6 个待办到期");
    expect(digest.lines).toHaveLength(5);
    expect(digest.lines[0]).toBe("任务0 · 今天 18:00");
  });
});

describe("reminderAlertOf", () => {
  it("卡片带上去重键、截止、优先级与说明摘要", () => {
    const alert = reminderAlertOf(task({ id: "t9", priority: "medium", description: "先和产品对齐口径" }), "zh-CN", NOW);
    expect(alert.key).toBe("t9:2026-09-16T17:30");
    expect(alert.dueLabel).toBe("今天 18:00");
    expect(alert.detail).toBe("先和产品对齐口径");
    expect(alert.overdue).toBe(false);
  });

  it("过了截止时刻标记为逾期", () => {
    expect(reminderAlertOf(task({ dueAt: "2026-09-16T09:00" }), "zh-CN", NOW).overdue).toBe(true);
  });
});
