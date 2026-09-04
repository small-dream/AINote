import { create } from "zustand";
import { messageOf } from "@/api/error";

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

/** 将非 React Query 的后台操作失败送入统一错误中心。 */
export function reportToastError(error: unknown): void {
  useToastStore.getState().push(messageOf(error), "error");
}
