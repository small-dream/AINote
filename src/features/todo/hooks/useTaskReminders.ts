import { useEffect, useRef } from "react";
import {
  cancel,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { translate } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import type { TaskItemDto } from "@/api/types";
import { reconcileReminders } from "../utils/task";

interface ScheduledEntry {
  id: number;
  remindAt: string;
}

interface ReminderState {
  scheduled: Map<string, ScheduledEntry>;
  /** 已补发（taskId:remindAt）去重，避免看板刷新时重复弹通知 */
  fired: Set<string>;
  permission: "unknown" | "granted" | "denied";
  /** 首次对账时清扫上一轮会话遗留的系统调度 */
  sweptPending: boolean;
}

/** 由 taskId 派生稳定的系统通知 id（跨会话一致，便于取消旧调度）。 */
function notificationIdOf(taskId: string): number {
  let hash = 0;
  for (const char of taskId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) || 1;
}

function notify(task: TaskItemDto, schedule?: Schedule): void {
  const locale = useUiStore.getState().locale;
  sendNotification({
    id: notificationIdOf(task.id),
    title: translate(locale, "todo.notifyTitle"),
    body: translate(locale, "todo.notifyBody", { title: task.title }),
    ...(schedule ? { schedule } : {}),
  });
}

/** 首次需要调度/补发时才请求权限；被拒静默降级。 */
async function ensurePermission(state: ReminderState): Promise<boolean> {
  if (state.permission === "granted") return true;
  if (state.permission === "denied") return false;
  try {
    const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    state.permission = granted ? "granted" : "denied";
    return granted;
  } catch {
    state.permission = "denied";
    return false;
  }
}

/** 取消不再需要的旧调度（完成/删除/remindAt 变更）。 */
async function cancelStale(state: ReminderState, desired: Map<string, string>): Promise<void> {
  for (const [taskId, entry] of state.scheduled) {
    if (desired.get(taskId) === entry.remindAt) continue;
    state.scheduled.delete(taskId);
    await cancel([entry.id]).catch(() => undefined);
  }
}

/** 首轮对账清扫系统侧遗留调度，避免重启后重复提醒。 */
async function sweepPendingOnce(state: ReminderState, desiredIds: Set<number>): Promise<void> {
  if (state.sweptPending) return;
  state.sweptPending = true;
  const stale = await pending().catch(() => []);
  const orphanIds = stale.map((item) => item.id).filter((id) => !desiredIds.has(id));
  if (orphanIds.length > 0) await cancel(orphanIds).catch(() => undefined);
}

async function reconcile(state: ReminderState, tasks: TaskItemDto[]): Promise<void> {
  const plan = reconcileReminders(tasks, new Date());
  const desired = new Map(plan.schedule.map((task) => [task.id, task.remindAt ?? ""]));
  await cancelStale(state, desired);
  if (plan.schedule.length === 0 && plan.overdue.length === 0) return;
  if (!(await ensurePermission(state))) return;
  await sweepPendingOnce(state, new Set([...desired.keys()].map(notificationIdOf)));
  for (const task of plan.schedule) {
    if (state.scheduled.has(task.id) || !task.remindAt) continue;
    const at = new Date(task.remindAt);
    notify(task, Schedule.at(at));
    state.scheduled.set(task.id, { id: notificationIdOf(task.id), remindAt: task.remindAt });
  }
  for (const task of plan.overdue) {
    const key = `${task.id}:${task.remindAt ?? ""}`;
    if (state.fired.has(key)) continue;
    state.fired.add(key);
    notify(task);
  }
}

/** 任务提醒调度：看板变化时按对账结果补调度、补发已到期通知。插件调用全部收敛在此。 */
export function useTaskReminders(repoPath: string | null): void {
  const { data: board } = useTaskBoardQuery(repoPath);
  const stateRef = useRef<ReminderState>({
    scheduled: new Map(),
    fired: new Set(),
    permission: "unknown",
    sweptPending: false,
  });

  useEffect(() => {
    if (!board) return;
    void reconcile(stateRef.current, board.tasks);
  }, [board]);
}
