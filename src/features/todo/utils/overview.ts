import type { TaskItemDto } from "@/api/types";
import { compareTasks, dueDayOffset } from "./task";

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
  const openTasks = tasks.filter((task) => !task.done);
  const focusTasks = openTasks
    .filter((task) => (task.dueDate ? dueDayOffset(task.dueDate, today) <= 0 : task.priority === "high"))
    .sort(compareTasks)
    .slice(0, 4);
  const upcomingTasks = openTasks
    .filter((task) => task.dueDate && dueDayOffset(task.dueDate, today) > 0)
    .sort(compareTasks)
    .slice(0, 4);
  const done = tasks.length - openTasks.length;

  return {
    total: tasks.length,
    open: openTasks.length,
    done,
    overdue: openTasks.filter((task) => task.dueDate !== null && dueDayOffset(task.dueDate, today) < 0).length,
    dueToday: openTasks.filter((task) => task.dueDate !== null && dueDayOffset(task.dueDate, today) === 0).length,
    progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    focusTasks,
    upcomingTasks,
  };
}
