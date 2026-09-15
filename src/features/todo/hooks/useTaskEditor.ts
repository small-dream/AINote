import { useState } from "react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { defaultRemindAt, fromLocalInputValue, toLocalInputValue } from "../utils/task";

export interface TaskDraft {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TaskPriority;
  remindAt: string | null;
}

function sameInstant(a: string | null, b: string | null): boolean {
  return (Date.parse(a ?? "") || 0) === (Date.parse(b ?? "") || 0);
}

/** 行内编辑器的草稿态与提交编排：元数据变更即保存，收起时有改动才提交标题。 */
export function useTaskEditor({ task, onSave, onClose }: { task: TaskItemDto; onSave: (draft: TaskDraft) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [remindValue, setRemindValue] = useState(toLocalInputValue(task.remindAt));

  function commit(overrides: Partial<TaskDraft>): boolean {
    const draft: TaskDraft = { title: title.trim(), description, dueDate, priority, remindAt: fromLocalInputValue(remindValue), ...overrides };
    if (!draft.title) {
      pushToast(t("todo.titleRequired"), "error");
      return false;
    }
    onSave(draft);
    return true;
  }

  function close(): void {
    const dirty = title.trim() !== task.title
      || description !== task.description
      || dueDate !== task.dueDate
      || priority !== task.priority
      || !sameInstant(fromLocalInputValue(remindValue), task.remindAt);
    if (dirty && !commit({})) return;
    onClose();
  }

  function commitDueDate(value: string | null): void {
    setDueDate(value);
    const remindAt = value === null ? null : fromLocalInputValue(remindValue);
    if (value === null) setRemindValue("");
    commit({ dueDate: value, remindAt });
  }

  function commitPriority(value: TaskPriority): void {
    setPriority(value);
    commit({ priority: value });
  }

  function toggleReminder(enabled: boolean): void {
    if (!dueDate) return;
    const nextValue = enabled ? toLocalInputValue(defaultRemindAt(dueDate)) : "";
    setRemindValue(nextValue);
    commit({ remindAt: fromLocalInputValue(nextValue) });
  }

  function commitReminder(value: string): void {
    setRemindValue(value);
    commit({ remindAt: fromLocalInputValue(value) });
  }

  return { title, setTitle, description, setDescription, dueDate, priority, remindValue, close, save: () => commit({}), commitDueDate, commitPriority, toggleReminder, commitReminder };
}
