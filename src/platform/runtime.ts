import { isTauriRuntime } from "@/api/back-button.api";

/** 当前是否运行在 Android 原生壳内（浏览器与桌面壳均为 false）。 */
export function isAndroidApp(): boolean {
  return isTauriRuntime() && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}
