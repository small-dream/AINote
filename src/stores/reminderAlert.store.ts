import { create } from "zustand";
import type { TaskPriority } from "@/api/types";

/** 应用内提醒卡片：不依赖系统通知权限，桌面端「没有任何提示」时的兜底通道 */
export interface ReminderAlertItem {
  /** `${taskId}:${remindAt}`，同一任务的同一次提醒只出现一张卡片 */
  key: string;
  taskId: string;
  title: string;
  dueLabel: string;
  priority: TaskPriority;
  /** 说明摘要；没有说明时为 null */
  detail: string | null;
  remindAt: string;
  overdue: boolean;
}

/** 同时堆叠的卡片上限：更早的提醒仍留在待办的「已逾期」分组里 */
export const MAX_REMINDER_ALERTS = 3;

interface ReminderAlertState {
  items: ReminderAlertItem[];
  push: (items: ReminderAlertItem[]) => void;
  dismiss: (key: string) => void;
  /** 只保留仍然有效的提醒（任务未完成、未删除、提醒时刻未变更） */
  retain: (keys: Set<string>) => void;
  clear: () => void;
}

export const useReminderAlertStore = create<ReminderAlertState>((set) => ({
  items: [],
  push: (incoming) => set((state) => {
    const known = new Set(state.items.map((item) => item.key));
    const fresh = incoming.filter((item) => !known.has(item.key));
    if (fresh.length === 0) return state;
    return { items: [...state.items, ...fresh].slice(-MAX_REMINDER_ALERTS) };
  }),
  dismiss: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
  retain: (keys) => set((state) => {
    const items = state.items.filter((item) => keys.has(item.key));
    return items.length === state.items.length ? state : { items };
  }),
  clear: () => set({ items: [] }),
}));
