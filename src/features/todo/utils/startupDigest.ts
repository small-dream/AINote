import type { TaskItemDto } from "@/api/types";
import { compareTasks, groupTasks, localDateString, type TaskGroup } from "./task";

/** 摘要卡里最多列出的任务条数；超出的只在计数里体现 */
export const DIGEST_TASK_LIMIT = 3;

/** 跨天重新评估的宽限：避开 00:00 整点边界，确保本地日期已经翻页 */
export const MIDNIGHT_GRACE_MS = 10_000;

/** 启动摘要：待处理任务的计数与最紧要的若干条 */
export interface StartupDigest {
  /** 未完成且已过截止时刻的任务数 */
  overdueCount: number;
  /** 未完成、今天到期且时刻未到的任务数 */
  dueTodayCount: number;
  /** 最紧要的若干条，逾期优先，组内沿用待办列表的排序 */
  items: TaskItemDto[];
  /** items 之外还剩多少条 */
  remaining: number;
  /** overdueCount + dueTodayCount */
  total: number;
}

/**
 * 「每天最多提示一次」的判定键：仓库 + 本地日期。
 * 不同仓库各自计时，同一仓库同一天只记一条。
 */
export function digestDateKey(repoPath: string, now: Date): string {
  return `${repoPath}@${localDateString(now)}`;
}

/** 到下一个本地 00:00 的毫秒数（含宽限），用于跨天重新评估 */
export function msUntilNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + MIDNIGHT_GRACE_MS;
}

/**
 * 组装启动摘要：没有「已逾期或今天到期」的任务时返回 null。
 * 口径与待办分组完全一致（逾期含「今天但已过具体时刻」；只到天的截止按当天 23:59）。
 */
export function buildStartupDigest(tasks: TaskItemDto[], now: Date): StartupDigest | null {
  const sections = groupTasks(tasks, now);
  const inGroup = (group: TaskGroup) => sections.find((section) => section.group === group)?.tasks ?? [];
  const overdue = inGroup("overdue");
  const dueToday = inGroup("today");
  const total = overdue.length + dueToday.length;
  if (total === 0) return null;
  const items = [...overdue, ...dueToday].sort(compareTasks).slice(0, DIGEST_TASK_LIMIT);
  return {
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    items,
    remaining: total - items.length,
    total,
  };
}
