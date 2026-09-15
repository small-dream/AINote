import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import {
  compareTasks,
  defaultRemindAt,
  dueDayOffset,
  fromLocalInputValue,
  groupTasks,
  localDateString,
  parseTaskInput,
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

describe("dueDayOffset", () => {
  const today = new Date(2026, 8, 15, 12, 0);
  it("0 今天、1 明天、负数已逾期", () => {
    expect(dueDayOffset("2026-09-15", today)).toBe(0);
    expect(dueDayOffset("2026-09-16", today)).toBe(1);
    expect(dueDayOffset("2026-09-14", today)).toBe(-1);
  });
});

describe("parseTaskInput", () => {
  // 2026-09-15 是周二
  const today = new Date(2026, 8, 15, 12, 0);

  it("识别相对日期关键词并从标题移除", () => {
    expect(parseTaskInput("写周报 明天", today)).toEqual({ title: "写周报", dueDate: "2026-09-16", priority: "none" });
    expect(parseTaskInput("今天 交房租", today)).toEqual({ title: "交房租", dueDate: "2026-09-15", priority: "none" });
    expect(parseTaskInput("大后天 体检", today)).toEqual({ title: "体检", dueDate: "2026-09-18", priority: "none" });
  });

  it("识别星期与下周", () => {
    expect(parseTaskInput("周五 交方案", today).dueDate).toBe("2026-09-18");
    expect(parseTaskInput("下周三 例会", today).dueDate).toBe("2026-09-23");
    expect(parseTaskInput("下周 复盘", today).dueDate).toBe("2026-09-21");
    expect(parseTaskInput("周二 同步", today).dueDate).toBe("2026-09-22");
  });

  it("识别具体日期，今年已过则滚动到明年", () => {
    expect(parseTaskInput("9月20日 还书", today).dueDate).toBe("2026-09-20");
    expect(parseTaskInput("1月5日 续费", today).dueDate).toBe("2027-01-05");
    expect(parseTaskInput("10-01 国庆出行", today).dueDate).toBe("2026-10-01");
    expect(parseTaskInput("2026年12月31日 年终总结", today).dueDate).toBe("2026-12-31");
    expect(parseTaskInput("13月40日 不存在", today).dueDate).toBeNull();
  });

  it("识别英文关键词", () => {
    expect(parseTaskInput("call mom tomorrow", today)).toEqual({ title: "call mom", dueDate: "2026-09-16", priority: "none" });
    expect(parseTaskInput("review next week", today).dueDate).toBe("2026-09-21");
    expect(parseTaskInput("submit friday", today).dueDate).toBe("2026-09-18");
  });

  it("识别优先级标记", () => {
    expect(parseTaskInput("修 bug p1", today)).toEqual({ title: "修 bug", dueDate: null, priority: "high" });
    expect(parseTaskInput("整理书架 P2", today).priority).toBe("medium");
    expect(parseTaskInput("归档 p3", today).priority).toBe("low");
    expect(parseTaskInput("!高 上线", today).priority).toBe("high");
    expect(parseTaskInput("版本 p123 不识别", today)).toEqual({ title: "版本 p123 不识别", dueDate: null, priority: "none" });
  });

  it("日期与优先级可组合，无匹配时原样保留", () => {
    expect(parseTaskInput("明天 写周报 p1", today)).toEqual({ title: "写周报", dueDate: "2026-09-16", priority: "high" });
    expect(parseTaskInput("随便记一笔", today)).toEqual({ title: "随便记一笔", dueDate: null, priority: "none" });
  });

  it("整段都是日期词时标题回退为原文", () => {
    expect(parseTaskInput("明天", today)).toEqual({ title: "明天", dueDate: "2026-09-16", priority: "none" });
  });
});
