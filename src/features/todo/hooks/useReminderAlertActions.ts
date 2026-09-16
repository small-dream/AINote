import { useTaskBoardQuery } from "@/queries/task.queries";
import { useReminderAlertStore, type ReminderAlertItem } from "@/stores/reminderAlert.store";
import { useUiStore } from "@/stores/ui.store";
import { useTaskMutations } from "./useTaskMutations";

/** 「稍后提醒」的间隔：10 分钟后重新提醒一次 */
export const SNOOZE_MS = 10 * 60 * 1000;

export interface ReminderAlertActions {
  /** 打开待办并定位到该任务 */
  onView: (item: ReminderAlertItem) => void;
  onComplete: (item: ReminderAlertItem) => void;
  onSnooze: (item: ReminderAlertItem) => void;
  onDismiss: (item: ReminderAlertItem) => void;
}

/** 提醒卡片的动作：查看任务、标记完成、稍后 10 分钟再提醒；动作后收起卡片 */
export function useReminderAlertActions(repoPath: string | null): ReminderAlertActions {
  const { data: board } = useTaskBoardQuery(repoPath);
  const mutations = useTaskMutations();
  const focusTask = useUiStore((state) => state.focusTask);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);

  function dismiss(key: string): void {
    useReminderAlertStore.getState().dismiss(key);
  }

  function snooze(item: ReminderAlertItem): void {
    const task = board?.tasks.find((candidate) => candidate.id === item.taskId);
    dismiss(item.key);
    if (!task) return;
    mutations.update.mutate({
      taskId: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt,
      priority: task.priority,
      remindAt: new Date(Date.now() + SNOOZE_MS).toISOString(),
    });
  }

  return {
    onView: (item) => {
      focusTask(item.taskId);
      setSidebarTab("todo");
      dismiss(item.key);
    },
    onComplete: (item) => {
      mutations.toggle.mutate(item.taskId);
      dismiss(item.key);
    },
    onSnooze: snooze,
    onDismiss: (item) => dismiss(item.key),
  };
}
