import { setDraftDirty } from "@/api/close-guard.api";
import { isTauriRuntime } from "@/api/back-button.api";

/** 未落盘草稿的登记项：由编辑器实例注册，离开编辑上下文前统一 flush。 */
export interface DraftEntry {
  /** 立即把当前草稿写入磁盘；失败时抛出，调用方据此中止离开流程。 */
  flush: () => Promise<void>;
  /** 当前是否仍有未落盘草稿 */
  isDirty: () => boolean;
}

const entries = new Set<DraftEntry>();
let reportedDirty: boolean | null = null;

/** 是否存在未落盘草稿（关闭确认与切换仓库据此判断）。 */
export function hasPendingDraft(): boolean {
  for (const entry of entries) {
    if (entry.isDirty()) return true;
  }
  return false;
}

/**
 * 依次 flush 全部草稿；任一步失败即抛出，调用方应中止离开流程（留在应用内）。
 * 复制快照后遍历，避免 flush 过程中注销登记项导致迭代异常。
 */
export async function flushPendingDrafts(): Promise<void> {
  for (const entry of [...entries]) {
    if (!entry.isDirty()) continue;
    await entry.flush();
  }
}

/** 注册编辑器草稿；返回注销函数（组件卸载时调用）。 */
export function registerDraft(entry: DraftEntry): () => void {
  entries.add(entry);
  publishDraftState();
  return () => {
    entries.delete(entry);
    publishDraftState();
  };
}

/** 草稿状态变化后通知 Rust；非 Tauri 环境（浏览器 / 单测）只维护本地状态。 */
export function publishDraftState(): void {
  const dirty = hasPendingDraft();
  if (dirty === reportedDirty) return;
  reportedDirty = dirty;
  if (!isTauriRuntime()) return;
  // 上报失败时清空缓存值，让下一次状态变化重试，不阻塞任何交互。
  try {
    void setDraftDirty(dirty).catch(() => {
      reportedDirty = null;
    });
  } catch {
    reportedDirty = null;
  }
}
