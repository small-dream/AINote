import type { TaskItemDto, TaskPriority } from "@/api/types";

export type TaskGroup = "overdue" | "today" | "upcoming" | "none" | "done";

export interface TaskGroupSection {
  group: TaskGroup;
  tasks: TaskItemDto[];
}

export const TASK_GROUP_ORDER: TaskGroup[] = ["overdue", "today", "upcoming", "none", "done"];

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** 本地日期的 YYYY-MM-DD（与 dueDate 同口径比较） */
export function localDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function groupOf(task: TaskItemDto, today: string): TaskGroup {
  if (task.done) return "done";
  if (!task.dueDate) return "none";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  return "upcoming";
}

/** 组内排序：dueDate 升序 → 优先级 high>medium>low>none → createdAt 升序 */
export function compareTasks(a: TaskItemDto, b: TaskItemDto): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** 把任务按逾期/今天/未来/无日期/已完成分组并排序；空组也保留（由 UI 决定是否隐藏）。 */
export function groupTasks(tasks: TaskItemDto[], today: string): TaskGroupSection[] {
  const sections: TaskGroupSection[] = TASK_GROUP_ORDER.map((group) => ({ group, tasks: [] }));
  for (const task of tasks) {
    sections[TASK_GROUP_ORDER.indexOf(groupOf(task, today))]?.tasks.push(task);
  }
  for (const section of sections) section.tasks.sort(compareTasks);
  return sections;
}

/** 默认提醒时间：截止日当天 09:00（本地时间）的 RFC3339。 */
export function defaultRemindAt(dueDate: string): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 9, 0, 0).toISOString();
}

/** RFC3339 → input[type=datetime-local] 的本地值；空值回退空串。 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${localDateString(date)}T${hh}:${mm}`;
}

/** input[type=datetime-local] 的本地值 → RFC3339；空串回退 null。 */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface ReminderPlan {
  /** 未完成且 remindAt 在未来：需要调度 */
  schedule: TaskItemDto[];
  /** 未完成且 remindAt 已过：需要补发 */
  overdue: TaskItemDto[];
}

/** 提醒对账：按当前时间把带提醒的未完成任务分为「待调度」与「已到期」两组。 */
export function reconcileReminders(tasks: TaskItemDto[], now: Date): ReminderPlan {
  const plan: ReminderPlan = { schedule: [], overdue: [] };
  for (const task of tasks) {
    if (task.done || !task.remindAt) continue;
    const at = new Date(task.remindAt);
    if (Number.isNaN(at.getTime())) continue;
    (at.getTime() > now.getTime() ? plan.schedule : plan.overdue).push(task);
  }
  return plan;
}
