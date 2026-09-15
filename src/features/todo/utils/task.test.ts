import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import {
  compareTasks,
  defaultRemindAt,
  fromLocalInputValue,
  groupTasks,
  localDateString,
  reconcileReminders,
  toLocalInputValue,
} from "./task";

function task(partial: Partial<TaskItemDto>): TaskItemDto {
  return {
    id: "t-1",
    listId: "l-1",
    title: "任务",
    done: false,
    priority: "none",
    dueDate: null,
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

describe("localDateString", () => {
  it("输出本地 YYYY-MM-DD 并补零", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("groupTasks", () => {
  const today = "2026-09-15";

  it("按逾期/今天/未来/无日期/已完成分组", () => {
    const sections = groupTasks([
      task({ id: "a", dueDate: "2026-09-14" }),
      task({ id: "b", dueDate: "2026-09-15" }),
      task({ id: "c", dueDate: "2026-09-20" }),
      task({ id: "d" }),
      task({ id: "e", done: true, dueDate: "2026-09-14" }),
    ], today);
    expect(sections.map((s) => [s.group, s.tasks.map((t) => t.id)])).toEqual([
      ["overdue", ["a"]],
      ["today", ["b"]],
      ["upcoming", ["c"]],
      ["none", ["d"]],
      ["done", ["e"]],
    ]);
  });

  it("组内按 dueDate → 优先级 → createdAt 排序", () => {
    const sections = groupTasks([
      task({ id: "late-created", dueDate: "2026-09-20", priority: "low", createdAt: "2026-09-02T00:00:00.000Z" }),
      task({ id: "high", dueDate: "2026-09-20", priority: "high", createdAt: "2026-09-03T00:00:00.000Z" }),
      task({ id: "early-due", dueDate: "2026-09-18", priority: "none" }),
      task({ id: "medium", dueDate: "2026-09-20", priority: "medium" }),
    ], today);
    expect(sections.find((s) => s.group === "upcoming")?.tasks.map((t) => t.id)).toEqual([
      "early-due",
      "high",
      "medium",
      "late-created",
    ]);
  });
});

describe("compareTasks", () => {
  it("无日期的排在有日期之后", () => {
    expect(compareTasks(task({ id: "a" }), task({ id: "b", dueDate: "2026-09-20" }))).toBe(1);
    expect(compareTasks(task({ id: "a", dueDate: "2026-09-20" }), task({ id: "b" }))).toBe(-1);
  });
});

describe("defaultRemindAt", () => {
  it("返回截止日当天本地 09:00 的 ISO 字符串", () => {
    const value = defaultRemindAt("2026-09-20");
    const date = new Date(value);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(20);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(0);
  });
});

describe("datetime-local 转换", () => {
  it("RFC3339 与本地输入值互相转换，空值回退", () => {
    expect(toLocalInputValue(null)).toBe("");
    expect(fromLocalInputValue("")).toBeNull();
    expect(toLocalInputValue("not-a-date")).toBe("");
    expect(fromLocalInputValue("not-a-date")).toBeNull();
    const iso = fromLocalInputValue("2026-09-20T09:30");
    expect(iso).not.toBeNull();
    expect(toLocalInputValue(iso)).toBe("2026-09-20T09:30");
  });
});

describe("reconcileReminders", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("未来提醒进调度组，已过提醒进补发组", () => {
    const plan = reconcileReminders([
      task({ id: "future", remindAt: "2026-09-16T01:00:00.000Z" }),
      task({ id: "past", remindAt: "2026-09-15T01:00:00.000Z" }),
    ], now);
    expect(plan.schedule.map((t) => t.id)).toEqual(["future"]);
    expect(plan.overdue.map((t) => t.id)).toEqual(["past"]);
  });

  it("已完成或无提醒的任务不参与对账，非法时间被忽略", () => {
    const plan = reconcileReminders([
      task({ id: "done", done: true, remindAt: "2026-09-16T01:00:00.000Z" }),
      task({ id: "no-remind" }),
      task({ id: "bad", remindAt: "not-a-date" }),
    ], now);
    expect(plan.schedule).toEqual([]);
    expect(plan.overdue).toEqual([]);
  });
});
