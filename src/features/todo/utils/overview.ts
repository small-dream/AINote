import type { TaskItemDto } from "@/api/types";
import { compareTasks, groupTasks, type TaskGroup } from "./task";

export interface TodoOverview {
  total: number;
  open: number;
  done: number;
  overdue: number;
  dueToday: number;
  progress: number;
  focusTasks: TaskItemDto[];
  upcomingTasks: TaskItemDto[];
}

export function buildTodoOverview(tasks: TaskItemDto[], today: Date): TodoOverview {
  const sections = groupTasks(tasks, today);
  const inGroup = (group: TaskGroup) => sections.find((section) => section.group === group)?.tasks ?? [];
  const overdue = inGroup("overdue");
  const dueToday = inGroup("today");
  const upcoming = inGroup("upcoming");
  const noDate = inGroup("none");
  const done = inGroup("done").length;
  // 重点任务：逾期 + 今天到期 + 无日期的高优先级，按截止时间与优先级重排
  const focusTasks = [...overdue, ...dueToday, ...noDate.filter((task) => task.priority === "high")]
    .sort(compareTasks)
    .slice(0, 4);

  return {
    total: tasks.length,
    open: overdue.length + dueToday.length + upcoming.length + noDate.length,
    done,
    overdue: overdue.length,
    dueToday: dueToday.length,
    progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    focusTasks,
    upcomingTasks: upcoming.sort(compareTasks).slice(0, 4),
  };
}
