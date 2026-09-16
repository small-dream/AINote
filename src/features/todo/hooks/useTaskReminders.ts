import { useEffect, useRef } from "react";
import type { TaskItemDto } from "@/api/types";
import { useTaskBoardQuery } from "@/queries/task.queries";
import {
  createReminderRuntime,
  disposeReminderRuntime,
  syncReminders,
  type ReminderRuntime,
} from "./reminderRuntime";

/**
 * 任务提醒编排：看板变化时对账（应用内提醒卡片 + 系统通知调度）。
 * 移动端把提醒交给 OS 预约（应用挂起仍可触发）；桌面端插件不支持预约调度，
 * 改由应用内定时器在到点时刻发出即时系统通知，应用内卡片是两端共用的兜底通道。
 */
export function useTaskReminders(repoPath: string | null): void {
  const { data: board } = useTaskBoardQuery(repoPath);
  const tasksRef = useRef<TaskItemDto[]>([]);
  const runtimeRef = useRef<ReminderRuntime | null>(null);
  runtimeRef.current ??= createReminderRuntime();

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!board || !runtime) return;
    tasksRef.current = board.tasks;
    void syncReminders(runtime, board.tasks, tasksRef);
  }, [board]);

  // 工作区卸载（退出登录 / 关闭窗口）时清掉未触发的定时器，避免回调打到已卸载的界面
  useEffect(() => {
    const runtime = runtimeRef.current;
    return () => {
      if (runtime) disposeReminderRuntime(runtime);
    };
  }, []);
}
