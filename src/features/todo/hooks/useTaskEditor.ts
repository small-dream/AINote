import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { shiftReminderOnDueChange } from "../utils/reminder";
import { normalizeDraft, sameDraft, taskToDraft, type TaskDraft } from "../utils/taskDraft";
import { useTaskDraftSync } from "./useTaskDraftSync";

export type { TaskDraft };

/** 标题 / 详情的自动保存窗口：短文本字段，比笔记正文的 3s 更短，让「已保存」及时落地。 */
export const TASK_AUTOSAVE_DEBOUNCE_MS = 1_500;

interface DraftState {
  /** 已对齐的服务端版本：props 停在这个版本上时不再调整草稿 */
  version: string;
  draft: TaskDraft;
  /** 最后一次确认落盘的内容 */
  baseline: TaskDraft;
}

/**
 * 草稿及其基准：基准 = 最后一次确认落盘的内容。
 *
 * 有基准才能同时回答「用户改过没有」和「这份改动写下去没有」——保存往返期间草稿已领先服务端，
 * 若直接拿服务端快照对比，状态会先跳回「未保存」再跳回「已保存」。
 */
function useTaskDraftState(task: TaskItemDto) {
  const [state, setState] = useState<DraftState>(() => ({
    version: task.updatedAt,
    draft: taskToDraft(task),
    baseline: taskToDraft(task),
  }));
  // 收起编辑器、卸载兜底都要读到最新草稿，不能依赖闭包里的那次渲染值。
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);

  // 服务端版本推进（同步拉到远端改动、提醒卡片改了这条任务）时按「渲染期调整状态」对齐：
  // 手上没有改动就整份采纳，否则会把别处刚写下的字段按旧值写回去；正在编辑则只推进基准、保留草稿，
  // 这一轮按「最后写入者优先」落盘。
  if (state.version !== task.updatedAt) {
    const snapshot = taskToDraft(task);
    setState({
      version: task.updatedAt,
      draft: sameDraft(state.draft, state.baseline) ? snapshot : state.draft,
      baseline: snapshot,
    });
  }

  const patch = useCallback((changes: Partial<TaskDraft>): TaskDraft => {
    const next = { ...latest.current.draft, ...changes };
    latest.current = { ...latest.current, draft: next };
    setState((current) => ({ ...current, draft: next }));
    return next;
  }, []);

  const confirmSaved = useCallback((settled: TaskDraft): void => {
    latest.current = { ...latest.current, baseline: settled };
    setState((current) => ({ ...current, baseline: settled }));
  }, []);

  return { draft: state.draft, dirty: !sameDraft(state.draft, state.baseline), latest, patch, confirmSaved };
}

interface UseTaskEditorOptions {
  task: TaskItemDto;
  onSave: (draft: TaskDraft) => Promise<void>;
  onClose: () => void;
}

/**
 * 任务编辑器的草稿态与提交编排：元数据 chips 即改即存，标题 / 详情防抖自动保存，
 * 收起、失焦与「完成」前补交最后一份草稿——用户不需要按保存，但随时看得见保存结果。
 */
export function useTaskEditor({ task, onSave, onClose }: UseTaskEditorOptions) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const { status, error, flush, autoFlush } = useTaskDraftSync({ commit: onSave });
  const { draft, dirty, latest, patch, confirmSaved } = useTaskDraftState(task);

  const save = useCallback(async (next: TaskDraft): Promise<boolean> => {
    if (!next.title.trim()) return false;
    if (!(await flush(next))) return false;
    confirmSaved(normalizeDraft(next));
    return true;
  }, [confirmSaved, flush]);

  /**
   * 内容没变就不提交：全量更新会刷新 updated_at，让 todos.json 凭空产生一次工作区变更，
   * 多端并发时正是「打开详情什么都没改，同步却冲突」的来源。
   */
  function saveIfChanged(next: TaskDraft): Promise<boolean> {
    if (sameDraft(next, latest.current.baseline)) return Promise.resolve(true);
    return save(next);
  }

  // 防抖自动保存：改动落定后写一次，期间继续输入会重新计时。
  useEffect(() => {
    if (!dirty || !draft.title.trim()) return undefined;
    const handle = setTimeout(() => { void save(draft); }, TASK_AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [dirty, draft, save]);

  // 卸载兜底：收起面板 / 切换任务会清掉定时器，这里把最后一次改动补交出去。
  useEffect(() => () => {
    const pending = latest.current.draft;
    if (!pending.title.trim() || sameDraft(pending, latest.current.baseline)) return;
    void autoFlush(pending);
  }, [autoFlush, latest]);

  function commit(changes: Partial<TaskDraft>): void {
    void saveIfChanged(patch(changes));
  }

  function commitDueDate(value: string | null): void {
    const current = latest.current.draft;
    commit({ dueAt: value, remindAt: shiftReminderOnDueChange(current.dueAt, value, current.remindAt) });
  }

  async function close(): Promise<void> {
    const current = latest.current.draft;
    if (!dirty) { onClose(); return; }
    if (!current.title.trim()) { pushToast(t("todo.titleRequired"), "error"); return; }
    // 保存失败就留在编辑器里：草稿、失败原因与重试入口同时可见，不允许静默丢改动。
    if (await saveIfChanged(current)) onClose();
  }

  return {
    title: draft.title,
    description: draft.description,
    dueAt: draft.dueAt,
    priority: draft.priority,
    remindAt: draft.remindAt,
    dirty,
    status,
    error,
    setTitle: (value: string) => patch({ title: value }),
    setDescription: (value: string) => patch({ description: value }),
    commitDueDate,
    commitPriority: (value: TaskPriority) => commit({ priority: value }),
    commitReminder: (value: string | null) => commit({ remindAt: value }),
    /** 失焦即时落盘；失败时草稿与错误留在状态区，不关闭编辑器 */
    save: () => saveIfChanged(latest.current.draft),
    retry: () => void save(latest.current.draft),
    close,
  };
}
