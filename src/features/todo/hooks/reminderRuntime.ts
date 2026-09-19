import type { TaskItemDto } from "@/api/types";
import { isTauriRuntime } from "@/api/back-button.api";
import {
  cancelReminderNotifications,
  needsDetailInBody,
  pendingNotificationIds,
  reminderDelivery,
  reminderScheduleAt,
  requestNotificationPermission,
  requestReminderAttention,
  sendReminderNotification,
  type ReminderNotificationOptions,
} from "@/platform/reminders";
import { useReminderAlertStore } from "@/stores/reminderAlert.store";
import { useUiStore } from "@/stores/ui.store";
import { reminderAlertOf, reminderDigestOf, reminderNoticeOf, type ReminderNotice } from "../utils/reminderMessage";
import { reconcileReminders } from "../utils/task";

/** 应用没运行时错过的提醒只在这个窗口内补一次；更早的仍留在待办的「已逾期」分组里 */
export const CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** setTimeout 的最大延时（约 24.8 天）：更远的提醒到点后重新挂表 */
const MAX_TIMEOUT_MS = 2_147_483_647;

const NOTIFICATION_GROUP = "ainote-todo";

interface TimerEntry {
  handle: number;
  remindAt: string;
}

interface ScheduledEntry {
  id: number;
  remindAt: string;
}

/** 任务列表的最新快照（定时器到点时要读当前任务，而不是挂表时的旧对象） */
export interface TaskListRef {
  readonly current: TaskItemDto[];
}

export interface ReminderRuntime {
  /** 桌面端：taskId → 应用内定时器 */
  timers: Map<string, TimerEntry>;
  /** 移动端：taskId → 已交给系统的调度 */
  scheduled: Map<string, ScheduledEntry>;
  /** 已提醒过的 `${taskId}:${remindAt}`，避免同一次提醒重复弹出 */
  fired: Set<string>;
  permission: "unknown" | "granted" | "denied";
  /** 首轮对账清扫系统侧遗留调度，避免重启后重复提醒 */
  sweptPending: boolean;
}

export function createReminderRuntime(): ReminderRuntime {
  return { timers: new Map(), scheduled: new Map(), fired: new Set(), permission: "unknown", sweptPending: false };
}

/** 卸载时清掉应用内定时器；系统侧调度按设计继续留给 OS */
export function disposeReminderRuntime(runtime: ReminderRuntime): void {
  for (const entry of runtime.timers.values()) window.clearTimeout(entry.handle);
  runtime.timers.clear();
}

function reminderKeyOf(task: TaskItemDto): string {
  return `${task.id}:${task.remindAt ?? ""}`;
}

/** 由 taskId 派生稳定的系统通知 id（跨会话一致，便于取消旧调度） */
function notificationIdOf(taskId: string): number {
  let hash = 0;
  for (const char of taskId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) || 1;
}

/** 首次真要发系统通知时才请求权限；被拒静默降级，应用内提醒卡片照常显示 */
async function ensurePermission(runtime: ReminderRuntime): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  if (runtime.permission === "granted") return true;
  if (runtime.permission === "denied") return false;
  try {
    const granted = await requestNotificationPermission();
    runtime.permission = granted ? "granted" : "denied";
    return granted;
  } catch {
    runtime.permission = "denied";
    return false;
  }
}

function noticeOf(tasks: TaskItemDto[], now: Date): { notice: ReminderNotice; taskId: string | null } {
  const locale = useUiStore.getState().locale;
  const first = tasks[0];
  if (tasks.length === 1 && first) return { notice: reminderNoticeOf(first, locale, now), taskId: first.id };
  return { notice: reminderDigestOf(tasks, locale, now), taskId: null };
}

/** 通知选项：标题带任务名、正文带截止与优先级、展开长文本放说明、多条走收件箱样式 */
function systemOptionsOf(tasks: TaskItemDto[], now: Date, at?: Date): ReminderNotificationOptions {
  const { notice, taskId } = noticeOf(tasks, now);
  const first = tasks[0];
  const detail = notice.detail;
  return {
    title: notice.title,
    // iOS 只认正文，Android 展开时看 largeBody：两端都要能读到任务说明
    body: detail && needsDetailInBody() ? `${notice.body}\n${detail}` : notice.body,
    ...(detail ? { largeBody: detail } : {}),
    ...(notice.lines.length > 0 ? { inboxLines: notice.lines } : {}),
    group: NOTIFICATION_GROUP,
    ...(taskId ? { extra: { taskId } } : {}),
    ...(at && first ? { id: notificationIdOf(first.id), schedule: reminderScheduleAt(at) } : {}),
  };
}

/** 应用内提醒卡片：不依赖系统通知权限，桌面端缺的提示由它兜底 */
function publishAlerts(tasks: TaskItemDto[], now: Date): void {
  const locale = useUiStore.getState().locale;
  useReminderAlertStore.getState().push(tasks.map((task) => reminderAlertOf(task, locale, now)));
}

/** 到点提醒：先落应用内卡片，再发系统通知并请求窗口注意 */
async function deliver(runtime: ReminderRuntime, tasks: TaskItemDto[], now: Date): Promise<void> {
  const active = tasks.filter((task) => !task.done && task.remindAt);
  if (active.length === 0) return;
  for (const task of active) runtime.fired.add(reminderKeyOf(task));
  publishAlerts(active, now);
  if (reminderDelivery() === "immediate" && (await ensurePermission(runtime))) sendReminderNotification(systemOptionsOf(active, now));
  void requestReminderAttention();
}

function armTimer(runtime: ReminderRuntime, task: TaskItemDto, tasksRef: TaskListRef): void {
  const remindAt = task.remindAt;
  if (!remindAt) return;
  const delay = Math.min(Math.max(Date.parse(remindAt) - Date.now(), 0), MAX_TIMEOUT_MS);
  const handle = window.setTimeout(() => {
    runtime.timers.delete(task.id);
    const latest = tasksRef.current.find((item) => item.id === task.id);
    if (!latest?.remindAt) return;
    if (Date.parse(latest.remindAt) > Date.now()) {
      armTimer(runtime, latest, tasksRef);
      return;
    }
    void deliver(runtime, [latest], new Date());
  }, delay);
  runtime.timers.set(task.id, { handle, remindAt });
}

/** 桌面端：按当前看板重挂定时器（完成 / 删除 / 改提醒时刻都要重挂） */
function syncTimers(runtime: ReminderRuntime, tasks: TaskItemDto[], tasksRef: TaskListRef): void {
  const now = Date.now();
  const upcoming = tasks.filter((task) => !task.done && task.remindAt && Date.parse(task.remindAt) > now);
  const desired = new Map(upcoming.map((task) => [task.id, task.remindAt as string]));
  for (const [taskId, entry] of runtime.timers) {
    if (desired.get(taskId) === entry.remindAt) continue;
    window.clearTimeout(entry.handle);
    runtime.timers.delete(taskId);
  }
  for (const task of upcoming) {
    if (runtime.timers.has(task.id)) continue;
    armTimer(runtime, task, tasksRef);
  }
}

/** 首轮对账清扫系统侧遗留调度，避免重启后重复提醒 */
async function sweepPendingOnce(runtime: ReminderRuntime, desiredIds: Set<number>): Promise<void> {
  if (runtime.sweptPending || !isTauriRuntime()) return;
  runtime.sweptPending = true;
  const stale = await pendingNotificationIds().catch(() => []);
  const orphanIds = stale.filter((id) => !desiredIds.has(id));
  if (orphanIds.length > 0) await cancelReminderNotifications(orphanIds).catch(() => undefined);
}

/** 移动端：把未来提醒交给 OS 预约（应用挂起仍可触发），并取消不再需要的旧调度 */
async function syncScheduled(runtime: ReminderRuntime, tasks: TaskItemDto[]): Promise<void> {
  const now = Date.now();
  const upcoming = tasks.filter((task) => !task.done && task.remindAt && Date.parse(task.remindAt) > now);
  const desired = new Map(upcoming.map((task) => [task.id, task.remindAt as string]));
  for (const [taskId, entry] of runtime.scheduled) {
    if (desired.get(taskId) === entry.remindAt) continue;
    runtime.scheduled.delete(taskId);
    await cancelReminderNotifications([entry.id]).catch(() => undefined);
  }
  if (upcoming.length === 0 || !(await ensurePermission(runtime))) return;
  await sweepPendingOnce(runtime, new Set(upcoming.map((task) => notificationIdOf(task.id))));
  for (const task of upcoming) {
    if (runtime.scheduled.has(task.id) || !task.remindAt) continue;
    sendReminderNotification(systemOptionsOf([task], new Date(), new Date(task.remindAt)));
    runtime.scheduled.set(task.id, { id: notificationIdOf(task.id), remindAt: task.remindAt });
  }
}

/** 已到期、落在补发窗口内且本轮尚未提醒过的任务 */
function dueTasksOf(tasks: TaskItemDto[], runtime: ReminderRuntime, now: Date): TaskItemDto[] {
  const { overdue } = reconcileReminders(tasks, now);
  return overdue.filter((task) => {
    if (runtime.fired.has(reminderKeyOf(task))) return false;
    return now.getTime() - Date.parse(task.remindAt ?? "") <= CATCH_UP_WINDOW_MS;
  });
}

/** 提醒对账：清理失效卡片、重挂调度、补发应用运行期间到点的提醒 */
export async function syncReminders(runtime: ReminderRuntime, tasks: TaskItemDto[], tasksRef: TaskListRef): Promise<void> {
  const now = new Date();
  useReminderAlertStore.getState().retain(new Set(tasks.filter((task) => !task.done && task.remindAt).map(reminderKeyOf)));
  if (reminderDelivery() === "scheduled") await syncScheduled(runtime, tasks);
  else syncTimers(runtime, tasks, tasksRef);
  await deliver(runtime, dueTasksOf(tasks, runtime, now), now);
}
