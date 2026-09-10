import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** 订阅 Rust 侧「有待提交变更的关闭请求」事件（桌面退出确认用）。 */
export async function onCloseRequested(handler: () => void): Promise<UnlistenFn> {
  return listen<null>("app:close-requested", () => handler());
}
