import { Check, Flag } from "lucide-react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { localDateString } from "../utils/task";

interface TaskRowProps {
  task: TaskItemDto;
  editing: boolean;
  onToggle: () => void;
  onOpenEditor: () => void;
}

const PRIORITY_FLAG_CLASS: Record<Exclude<TaskPriority, "none">, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-accent",
};

const PRIORITY_LABEL_KEY: Record<Exclude<TaskPriority, "none">, TranslationKey> = {
  high: "todo.priorityHigh",
  medium: "todo.priorityMedium",
  low: "todo.priorityLow",
};

function DueBadge({ dueDate, done }: { dueDate: string; done: boolean }) {
  const today = localDateString(new Date());
  const overdue = !done && dueDate < today;
  const isToday = !done && dueDate === today;
  const tone = overdue
    ? "bg-danger/10 text-danger"
    : isToday
      ? "bg-accent/10 text-accent"
      : "bg-bg-tertiary text-text-tertiary";
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
      {dueDate.slice(5)}
    </span>
  );
}

/** 单条任务行：完成勾选、标题（完成删除线）、截止徽标、优先级旗帜。 */
export function TaskRow({ task, editing, onToggle, onOpenEditor }: TaskRowProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-tertiary ${editing ? "bg-bg-tertiary" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.title}
        onClick={onToggle}
        className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border transition-colors ${task.done ? "border-accent bg-accent text-white" : "border-text-tertiary hover:border-accent"}`}
      >
        {task.done ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
      </button>
      <button
        type="button"
        onClick={onOpenEditor}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-text-tertiary line-through" : "text-text-primary"}`}>
          {task.title}
        </span>
        {task.dueDate ? <DueBadge dueDate={task.dueDate} done={task.done} /> : null}
        {task.priority !== "none" ? (
          <Flag size={12} className={`shrink-0 ${PRIORITY_FLAG_CLASS[task.priority]}`} aria-label={t(PRIORITY_LABEL_KEY[task.priority])} />
        ) : null}
      </button>
    </div>
  );
}
