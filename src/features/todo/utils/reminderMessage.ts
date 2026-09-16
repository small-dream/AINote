import type { TaskItemDto, TaskPriority } from "@/api/types";
import { translate } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { Locale } from "@/stores/ui.store";
import type { ReminderAlertItem } from "@/stores/reminderAlert.store";
import { dueDateLabel, dueDay, dueDayOffset, dueInstant, dueTime } from "./task";

/** 说明摘要上限：过长会撑爆通知的折叠视图与提醒卡片 */
export const NOTICE_EXCERPT_LIMIT = 120;

/** 通知里最多列出的任务条数（Android inbox 样式只支持 5 行） */
export const NOTICE_LINE_LIMIT = 5;

const PRIORITY_KEYS: Record<TaskPriority, TranslationKey> = {
  high: "todo.priorityHigh",
  medium: "todo.priorityMedium",
  low: "todo.priorityLow",
  none: "todo.priorityNone",
};

/** 通知/提醒卡片的一条文案：标题、正文、可展开的长文本与多任务行 */
export interface ReminderNotice {
  title: string;
  body: string;
  /** 说明摘要（通知展开视图）；没有说明时为 null */
  detail: string | null;
  /** 多任务合并时的逐条摘要行 */
  lines: string[];
}

/** 把说明压成单行摘要：折叠换行、截断过长内容，空说明返回 null */
export function reminderExcerpt(description: string): string | null {
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > NOTICE_EXCERPT_LIMIT ? `${text.slice(0, NOTICE_EXCERPT_LIMIT)}…` : text;
}

/** 截止时间的一行描述：今天 18:00 / 明天 / 09-20 18:00；无截止时间为 null */
export function reminderDueLabel(task: TaskItemDto, locale: Locale, now: Date): string | null {
  if (!task.dueAt) return null;
  const dayLabel = dueDateLabel(
    task.dueAt,
    translate(locale, "todo.dateToday"),
    translate(locale, "todo.dateTomorrow"),
    now
  );
  const offset = dueDayOffset(task.dueAt, now);
  const day = offset === 2 ? translate(locale, "todo.dateDayAfter") : offset >= 3 ? dueDay(task.dueAt).slice(5) : dayLabel;
  const time = dueTime(task.dueAt);
  return time ? `${day} ${time}` : day;
}

/** 优先级文案；无优先级返回 null */
export function reminderPriorityLabel(task: TaskItemDto, locale: Locale): string | null {
  if (task.priority === "none") return null;
  return translate(locale, PRIORITY_KEYS[task.priority]);
}

/** 任务是否已过截止时刻（只到天的截止视为当天 23:59） */
export function isTaskOverdue(task: TaskItemDto, now: Date): boolean {
  return task.dueAt !== null && dueInstant(task.dueAt).getTime() < now.getTime();
}

/** 通知正文：截止时间与优先级用 · 连接；两者都缺时退回通用提醒文案 */
function noticeBodyOf(task: TaskItemDto, locale: Locale, now: Date): string {
  const due = reminderDueLabel(task, locale, now);
  const priority = reminderPriorityLabel(task, locale);
  const parts = [due ? translate(locale, "todo.notifyDue", { due }) : null, priority ? translate(locale, "todo.notifyPriority", { priority }) : null];
  return parts.filter((part) => part !== null).join(" · ") || translate(locale, "todo.reminder");
}

/** 单条任务提醒的通知文案：标题带任务名，正文带截止/优先级，长文本放说明 */
export function reminderNoticeOf(task: TaskItemDto, locale: Locale, now: Date): ReminderNotice {
  return {
    title: translate(locale, isTaskOverdue(task, now) ? "todo.notifyTitleOverdue" : "todo.notifyTitleTask", { title: task.title }),
    body: noticeBodyOf(task, locale, now),
    detail: reminderExcerpt(task.description),
    lines: [],
  };
}

/** 多条任务同时到期：合并成一条摘要通知，逐条列出任务名与截止时间 */
export function reminderDigestOf(tasks: TaskItemDto[], locale: Locale, now: Date): ReminderNotice {
  return {
    title: translate(locale, "todo.notifyDigestTitle", { count: tasks.length }),
    body: translate(locale, "todo.notifyDigestBody"),
    detail: null,
    lines: tasks
      .slice(0, NOTICE_LINE_LIMIT)
      .map((task) => translate(locale, "todo.notifyLine", { title: task.title, due: reminderDueLabel(task, locale, now) ?? "" })),
  };
}

/** 应用内提醒卡片的一条条目：不依赖系统通知权限，桌面与移动共用 */
export function reminderAlertOf(task: TaskItemDto, locale: Locale, now: Date): ReminderAlertItem {
  return {
    key: `${task.id}:${task.remindAt ?? ""}`,
    taskId: task.id,
    title: task.title,
    dueLabel: reminderDueLabel(task, locale, now) ?? translate(locale, "todo.dueDate"),
    priority: task.priority,
    detail: reminderExcerpt(task.description),
    remindAt: task.remindAt ?? "",
    overdue: isTaskOverdue(task, now),
  };
}
