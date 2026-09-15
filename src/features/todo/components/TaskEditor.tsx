import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useToastStore } from "@/stores/toast.store";
import { defaultRemindAt, fromLocalInputValue, toLocalInputValue } from "../utils/task";

export interface TaskDraft {
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  remindAt: string | null;
}

interface TaskEditorProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => void;
  onDelete: () => void;
}

const FIELD_CLASS = "rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent";
const LABEL_CLASS = "flex items-center gap-2 text-xs text-text-secondary";

/** 任务行内编辑器：标题 / 截止日期 / 优先级 / 提醒（全量字段提交，由后端校验）。 */
export function TaskEditor({ task, busy, onSave, onDelete }: TaskEditorProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [remindValue, setRemindValue] = useState(toLocalInputValue(task.remindAt));

  function commit(overrides: Partial<TaskDraft>): void {
    const draft: TaskDraft = { title: title.trim(), dueDate, priority, remindAt: fromLocalInputValue(remindValue), ...overrides };
    if (!draft.title) {
      pushToast(t("todo.titleRequired"), "error");
      return;
    }
    onSave(draft);
  }

  function commitDueDate(value: string): void {
    const nextDue = value || null;
    setDueDate(nextDue);
    const remindAt = nextDue === null ? null : fromLocalInputValue(remindValue);
    if (nextDue === null) setRemindValue("");
    commit({ dueDate: nextDue, remindAt });
  }

  return (
    <div className="mx-2 mb-2 flex flex-col gap-2 rounded-md border border-border bg-bg-secondary p-2.5">
      <input
        className={`${FIELD_CLASS} w-full text-sm`}
        value={title}
        aria-label={t("todo.taskTitle")}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => commit({})}
        onKeyDown={(event) => { if (event.key === "Enter") commit({}); }}
      />
      <MetaRow
        dueDate={dueDate}
        priority={priority}
        onDueDateChange={commitDueDate}
        onPriorityChange={(value) => { setPriority(value); commit({ priority: value }); }}
      />
      <ReminderRow
        dueDate={dueDate}
        remindValue={remindValue}
        onToggle={(enabled) => {
          if (!dueDate) return;
          const nextValue = enabled ? toLocalInputValue(defaultRemindAt(dueDate)) : "";
          setRemindValue(nextValue);
          commit({ remindAt: fromLocalInputValue(nextValue) });
        }}
        onChange={(value) => { setRemindValue(value); commit({ remindAt: fromLocalInputValue(value) }); }}
      />
      <div className="flex justify-end">
        <button type="button" onClick={onDelete} disabled={busy} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50">
          <Trash2 size={12} aria-hidden="true" />
          {t("todo.deleteTask")}
        </button>
      </div>
    </div>
  );
}

const PRIORITY_OPTIONS: { value: TaskPriority; key: TranslationKey }[] = [
  { value: "none", key: "todo.priorityNone" },
  { value: "low", key: "todo.priorityLow" },
  { value: "medium", key: "todo.priorityMedium" },
  { value: "high", key: "todo.priorityHigh" },
];

interface MetaRowProps {
  dueDate: string | null;
  priority: TaskPriority;
  onDueDateChange: (value: string) => void;
  onPriorityChange: (value: TaskPriority) => void;
}

function MetaRow({ dueDate, priority, onDueDateChange, onPriorityChange }: MetaRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className={LABEL_CLASS}>
        {t("todo.dueDate")}
        <input type="date" className={FIELD_CLASS} value={dueDate ?? ""} onChange={(event) => onDueDateChange(event.target.value)} />
      </label>
      <label className={LABEL_CLASS}>
        {t("todo.priority")}
        <select className={FIELD_CLASS} value={priority} onChange={(event) => onPriorityChange(event.target.value as TaskPriority)}>
          {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
        </select>
      </label>
    </div>
  );
}

interface ReminderRowProps {
  dueDate: string | null;
  remindValue: string;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}

function ReminderRow({ dueDate, remindValue, onToggle, onChange }: ReminderRowProps) {
  const { t } = useTranslation();
  const disabled = !dueDate;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={LABEL_CLASS} title={disabled ? t("todo.reminderNeedsDue") : undefined}>
        <input type="checkbox" checked={remindValue !== ""} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} />
        {t("todo.reminder")}
      </label>
      {remindValue !== "" ? (
        <input type="datetime-local" className={FIELD_CLASS} value={remindValue} onChange={(event) => onChange(event.target.value)} />
      ) : null}
      {disabled ? <span className="text-[11px] text-text-tertiary">{t("todo.reminderNeedsDue")}</span> : null}
    </div>
  );
}
