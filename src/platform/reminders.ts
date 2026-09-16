import { isTauriRuntime } from "@/api/back-button.api";
import { isIosApp, isMobileApp } from "./runtime";

/**
 * 系统通知的下发方式。
 * `scheduled`：移动端把提醒交给 OS 预约，应用挂起后仍能触发。
 * `immediate`：桌面端插件不支持预约调度（`schedule` 只在移动端生效），只能应用内定时、到点即时发出。
 */
export type ReminderDelivery = "scheduled" | "immediate";

export function reminderDelivery(): ReminderDelivery {
  return isMobileApp() ? "scheduled" : "immediate";
}

/** iOS 没有 Android 的 big text 样式（`largeBody` 只在 Android 生效），说明摘要要并入正文才看得见。 */
export function needsDetailInBody(): boolean {
  return isIosApp();
}

/** 通知点击后带回来的任务 id（`extra` 只放字符串，iOS 侧只接受扁平字符串表）。 */
export function taskIdOfNotification(extra: Record<string, unknown> | undefined): string | null {
  const taskId = extra?.taskId;
  return typeof taskId === "string" && taskId.length > 0 ? taskId : null;
}

/**
 * 到点时把窗口拉回用户面前：桌面端未聚焦时弹跳 Dock / 任务栏图标。
 * 移动端与浏览器无操作；权限缺失或不支持时静默降级，不影响系统通知与应用内提醒卡片。
 */
export async function requestReminderAttention(): Promise<void> {
  if (!isTauriRuntime() || isMobileApp()) return;
  try {
    const { getCurrentWindow, UserAttentionType } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();
    if (await current.isFocused()) return;
    await current.requestUserAttention(UserAttentionType.Informational);
  } catch {
    return;
  }
}
