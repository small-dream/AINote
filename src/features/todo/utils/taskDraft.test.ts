import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { normalizeDraft, sameDraft, taskToDraft, type TaskDraft } from "./taskDraft";

function draft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return { title: "写周报", description: "", dueAt: null, priority: "none", remindAt: null, ...overrides };
}

describe("taskToDraft", () => {
  it("只取可编辑字段，不带 id / done / 时间戳", () => {
    const task = {
      id: "t-1",
      title: "写周报",
      description: "三条",
      done: true,
      priority: "high",
      dueAt: "2026-09-21T18:00",
      remindAt: "2026-09-21T17:45",
      sortOrder: 3,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-16T08:00:00.000Z",
      completedAt: "2026-09-16T09:00:00.000Z",
    } satisfies TaskItemDto;

    expect(taskToDraft(task)).toEqual({
      title: "写周报",
      description: "三条",
      dueAt: "2026-09-21T18:00",
      priority: "high",
      remindAt: "2026-09-21T17:45",
    });
  });
});

describe("normalizeDraft", () => {
  it("标题去两端空白；没有截止时间时提醒一并清空", () => {
    expect(normalizeDraft(draft({ title: "  写周报  ", dueAt: null, remindAt: "2026-09-21T17:45" })))
      .toEqual(draft({ title: "写周报", remindAt: null }));
  });

  it("有截止时间时保留提醒", () => {
    const remindAt = "2026-09-21T17:45";
    expect(normalizeDraft(draft({ dueAt: "2026-09-21T18:00", remindAt })).remindAt).toBe(remindAt);
  });
});

describe("sameDraft", () => {
  it("标题只差两端空白视为未改动，避免只多打一个空格就判成可保存", () => {
    expect(sameDraft(draft({ title: "写周报 " }), draft({ title: " 写周报" }))).toBe(true);
  });

  it("提醒时刻按绝对时间比较，字符串形态不同但同一时刻算未改动", () => {
    const a = draft({ dueAt: "2026-09-21T18:00", remindAt: "2026-09-21T17:45:00+08:00" });
    const b = draft({ dueAt: "2026-09-21T18:00", remindAt: "2026-09-21T09:45:00.000Z" });
    expect(sameDraft(a, b)).toBe(true);
  });

  it("任一实质字段不同即为有改动", () => {
    const base = draft();
    expect(sameDraft(base, draft({ description: "补一句" }))).toBe(false);
    expect(sameDraft(base, draft({ dueAt: "2026-09-21" }))).toBe(false);
    expect(sameDraft(base, draft({ priority: "low" }))).toBe(false);
    expect(sameDraft(base, draft({ title: "交周报" }))).toBe(false);
  });
});
