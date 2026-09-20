import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf } from "@/api";
import type { TaskSaveStatus } from "../utils/saveState";
import { normalizeDraft, sameDraft, type TaskDraft } from "../utils/taskDraft";

interface UseTaskDraftSyncOptions {
  /** 提交一份草稿；抛错即视为保存失败，由本 hook 收敛成展示状态 */
  commit: (draft: TaskDraft) => Promise<void>;
}

/**
 * 草稿提交队列：把零散的写入串行化，并把结果收敛成「空闲 / 保存中 / 已保存 / 失败」四态。
 *
 * - `flush` 强制提交：收起编辑器、失焦、点「完成」与「重试」都走它；
 * - `autoFlush` 供防抖自动保存使用：同一份草稿已经失败过就不再重试，避免后端持续报错时反复打请求；
 *   用户继续编辑（草稿变了）或显式重试后才恢复自动保存。
 */
export function useTaskDraftSync({ commit }: UseTaskDraftSyncOptions) {
  const [status, setStatus] = useState<TaskSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<{ draft: TaskDraft; result: Promise<boolean> } | null>(null);
  const failedDraft = useRef<TaskDraft | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; });

  const run = useCallback(async (target: TaskDraft): Promise<boolean> => {
    setStatus("saving");
    setError(null);
    // 包一层 Promise.resolve：commit 同步抛错也不会漏掉状态收敛。
    const request = Promise.resolve().then(() => commitRef.current(target));
    try {
      await request;
      failedDraft.current = null;
      setStatus("saved");
      return true;
    } catch (cause) {
      failedDraft.current = target;
      setStatus("error");
      setError(messageOf(cause));
      return false;
    }
  }, []);

  const flush = useCallback(async (draft: TaskDraft): Promise<boolean> => {
    const target = normalizeDraft(draft);
    const pending = inFlight.current;
    if (pending) {
      // 串行化：等在途提交结束再决定下一步，避免两份草稿互相覆盖。
      const previous = await pending.result;
      // 在途那一份写的就是这份草稿（打完字立刻点「完成」）：直接复用结果，不重复写盘。
      if (sameDraft(pending.draft, target)) return previous;
    }
    const result = run(target);
    inFlight.current = { draft: target, result };
    try {
      return await result;
    } finally {
      if (inFlight.current?.result === result) inFlight.current = null;
    }
  }, [run]);

  const autoFlush = useCallback(async (draft: TaskDraft): Promise<void> => {
    const target = normalizeDraft(draft);
    if (failedDraft.current && sameDraft(failedDraft.current, target)) return;
    await flush(target);
  }, [flush]);

  return { status, error, flush, autoFlush };
}
