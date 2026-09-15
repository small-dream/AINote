import { useState } from "react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { shiftReminderOnDueChange } from "../utils/reminder";

export interface TaskDraft {
  title: string;
  description: string;
  dueAt: string | null;
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
  const [dueAt, setDueAt] = useState(task.dueAt);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [remindAt, setRemindAt] = useState(task.remindAt);

  function commit(overrides: Partial<TaskDraft>): boolean {
    const draft: TaskDraft = { title: title.trim(), description, dueAt, priority, remindAt, ...overrides };
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
      || dueAt !== task.dueAt
      || priority !== task.priority
      || !sameInstant(remindAt, task.remindAt);
    if (dirty && !commit({})) return;
    onClose();
  }

  function commitDueDate(value: string | null): void {
    const nextRemindAt = shiftReminderOnDueChange(dueAt, value, remindAt);
    setRemindAt(nextRemindAt);
    setDueAt(value);
    commit({ dueAt: value, remindAt: nextRemindAt });
  }

  function commitPriority(value: TaskPriority): void {
    setPriority(value);
    commit({ priority: value });
  }

  function commitReminder(value: string | null): void {
    setRemindAt(value);
    commit({ remindAt: value });
  }

  return { title, setTitle, description, setDescription, dueAt, priority, remindAt, close, save: () => commit({}), commitDueDate, commitPriority, commitReminder };
}
