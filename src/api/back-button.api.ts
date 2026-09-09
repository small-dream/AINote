import { onBackButtonPress } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";

/** 当前是否运行在 Tauri 壳内（桌面 / 移动），浏览器与测试环境为 false。 */
export function isTauriRuntime(): boolean {
  return isTauri();
}

/** 订阅 Android 系统返回键；返回取消订阅函数（其他平台不触发）。 */
export async function onAndroidBackButton(handler: () => void): Promise<() => void> {
  const listener = await onBackButtonPress(handler);
  return () => {
    void listener.unregister().catch(() => undefined);
  };
}
