import { useMemo, useState } from "react";
import type { CreateTaskInput } from "@/api";
import type { TaskPriority } from "@/api/types";
import { shiftReminderOnDueChange } from "../utils/reminder";
import { parseTaskInput } from "../utils/task";

/**
 * 新建任务弹窗的草稿态：标题走自然语言识别，日期/优先级/提醒保留手动覆盖值。
 * 手动覆盖优先于识别结果，提交时归一为 task_create 入参。
 */
export function useNewTaskDraft() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAtOverride, setDueAtOverride] = useState<string | null>(null);
  const [priorityOverride, setPriorityOverride] = useState<TaskPriority | null>(null);
  const [remindAt, setRemindAt] = useState<string | null>(null);

  const parsed = useMemo(() => parseTaskInput(title, new Date()), [title]);
  const dueAt = dueAtOverride ?? parsed.dueAt;
  const priority = priorityOverride ?? parsed.priority;

  /** 清除截止时间时必须一并清掉提醒，避免后端拒绝「有提醒无截止时间」。 */
  function changeDueAt(value: string | null): void {
    setRemindAt((current) => shiftReminderOnDueChange(dueAt, value, current));
    setDueAtOverride(value);
  }

  function toInput(): CreateTaskInput {
    return {
      title: parsed.title.trim(),
      description: description.trim(),
      dueAt,
      priority,
      remindAt: dueAt ? remindAt : null,
    };
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    dueAt,
    priority,
    setPriority: setPriorityOverride,
    remindAt,
    setRemindAt,
    changeDueAt,
    toInput,
    valid: parsed.title.trim().length > 0,
  };
}
