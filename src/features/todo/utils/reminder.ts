import type { TranslationKey } from "@/i18n/messages";
import { dueDay, dueInstant, toLocalInputValue } from "./task";

export interface ReminderPreset {
  /** 提前的分钟数；0 表示与截止时刻同时提醒 */
  minutes: number;
  labelKey: TranslationKey;
  /** 文案里的数量（分钟/小时/天） */
  count?: number;
}

/** 相对截止时间的提醒预设：覆盖「准时 → 提前一天」的常见提前量 */
export const REMINDER_PRESETS: ReminderPreset[] = [
  { minutes: 0, labelKey: "todo.reminderOnTime" },
  { minutes: 5, labelKey: "todo.reminderBeforeMinutes", count: 5 },
  { minutes: 15, labelKey: "todo.reminderBeforeMinutes", count: 15 },
  { minutes: 30, labelKey: "todo.reminderBeforeMinutes", count: 30 },
  { minutes: 60, labelKey: "todo.reminderBeforeHours", count: 1 },
  { minutes: 1440, labelKey: "todo.reminderBeforeDays", count: 1 },
];

/** 提醒相对截止时刻提前了多少分钟；时间非法返回 null */
export function reminderLeadMinutes(dueAt: string, remindAt: string): number | null {
  const at = Date.parse(remindAt);
  if (Number.isNaN(at)) return null;
  return Math.round((dueInstant(dueAt).getTime() - at) / 60000);
}

/** 当前提醒匹配到的预设；不匹配（自定义时刻）返回 null */
export function reminderPresetOf(dueAt: string, remindAt: string): ReminderPreset | null {
  const lead = reminderLeadMinutes(dueAt, remindAt);
  if (lead === null) return null;
  return REMINDER_PRESETS.find((preset) => preset.minutes === lead) ?? null;
}

/** 按预设算出绝对提醒时刻（RFC3339） */
export function remindAtForPreset(dueAt: string, minutes: number): string {
  return new Date(dueInstant(dueAt).getTime() - minutes * 60000).toISOString();
}

/** 把提醒设成「截止日当天」的指定钟点（HH:mm） */
export function remindAtOnDueDay(dueAt: string, clock: string): string {
  const [hour, minute] = clock.split(":").map(Number);
  const [year, month, day] = dueDay(dueAt).split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 9, minute ?? 0).toISOString();
}

/** 提醒的本地钟点 HH:mm；无提醒时回退 09:00（与默认提醒一致） */
export function reminderClock(remindAt: string | null): string {
  const local = toLocalInputValue(remindAt);
  return local ? local.slice(11, 16) : "09:00";
}

/**
 * 截止时间变化时的提醒迁移：相对型提醒（准时 / 提前 N）按同一提前量跟着走；
 * 自定义钟点保持原样，用户显式选的绝对时刻不该被悄悄改动。截止时间清空时提醒一并清空。
 */
export function shiftReminderOnDueChange(
  previousDueAt: string | null,
  nextDueAt: string | null,
  remindAt: string | null,
): string | null {
  if (nextDueAt === null || remindAt === null) return null;
  const preset = previousDueAt ? reminderPresetOf(previousDueAt, remindAt) : null;
  return preset ? remindAtForPreset(nextDueAt, preset.minutes) : remindAt;
}
