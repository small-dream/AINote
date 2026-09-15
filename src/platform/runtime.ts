import { isTauriRuntime } from "@/api/back-button.api";

/** 当前是否运行在 Android 原生壳内（浏览器与桌面壳均为 false）。 */
export function isAndroidApp(): boolean {
  return isTauriRuntime() && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/**
 * 当前是否运行在 iOS / iPadOS 原生壳内（浏览器与桌面壳均为 false）。
 * iPadOS 13+ 默认上报桌面级 UA（Macintosh），用触点数量把 iPad 与 Mac 区分开。
 */
export function isIosApp(): boolean {
  if (!isTauriRuntime() || typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/** 当前是否运行在移动壳内（Android / iOS）：移动端专属能力的统一判定入口。 */
export function isMobileApp(): boolean {
  return isAndroidApp() || isIosApp();
}
