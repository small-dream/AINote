import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { call } from "./client";

/** 订阅 Rust 侧「有待提交变更的关闭请求」事件（桌面退出确认用）。 */
export async function onCloseRequested(handler: () => void): Promise<UnlistenFn> {
  return listen<null>("app:close-requested", () => handler());
}

/**
 * 上报编辑器是否存在未落盘草稿。
 * 未落盘草稿还没写进工作区，`git status` 看不到，Rust 只能靠这份状态决定是否拦截关闭。
 */
export async function setDraftDirty(dirty: boolean): Promise<void> {
  await call("set_draft_dirty", { dirty });
}
