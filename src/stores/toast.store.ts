import { create } from "zustand";
import { errorActionOf, isAppError, messageOf, type ErrorAction } from "@/api/error";
import { translate } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useUiStore } from "@/stores/ui.store";

export type ToastTone = "error" | "success" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone, durationMs?: number) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let nextToastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = "error", durationMs = 6000) => {
    const id = `toast-${nextToastId += 1}`;
    set((state) => ({ items: [...state.items.slice(-4), { id, tone, message }] }));
    if (durationMs > 0) {
      globalThis.setTimeout(() => set((state) => ({ items: state.items.filter((item) => item.id !== id) })), durationMs);
    }
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => set({ items: [] }),
}));

const ERROR_ACTION_KEY: Record<ErrorAction, TranslationKey> = {
  retry: "error.sync.network",
  relogin: "error.sync.auth",
  checkPermission: "error.sync.permission",
};

/** 技术细节 + 本地化可操作建议；无建议时只保留原始信息。 */
export function toastMessageOf(error: unknown): string {
  const message = messageOf(error);
  if (!isAppError(error)) return message;
  const action = errorActionOf(error);
  if (!action) return message;
  return `${message} · ${translate(useUiStore.getState().locale, ERROR_ACTION_KEY[action])}`;
}

/** 将非 React Query 的后台操作失败送入统一错误中心。 */
export function reportToastError(error: unknown): void {
  useToastStore.getState().push(toastMessageOf(error), "error");
}
