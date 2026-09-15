import { Check, Flag } from "lucide-react";
import type { TaskItemDto, TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { PRIORITY_FLAG_CLASS } from "./TaskMetaControls";
import { dueDayOffset } from "../utils/task";

interface TaskRowProps {
  task: TaskItemDto;
  onToggle: () => void;
  onOpenEditor: () => void;
}

const PRIORITY_LABEL_KEY: Record<Exclude<TaskPriority, "none">, TranslationKey> = {
  high: "todo.priorityHigh",
  medium: "todo.priorityMedium",
  low: "todo.priorityLow",
};

export function DueBadge({ dueDate, done }: { dueDate: string; done: boolean }) {
  const { t } = useTranslation();
  const offset = dueDayOffset(dueDate, new Date());
  const label = !done && offset === 0
    ? t("todo.dateToday")
    : !done && offset === 1
      ? t("todo.dateTomorrow")
      : dueDate.slice(5);
  const tone = !done && offset < 0
    ? "bg-danger/10 text-danger"
    : !done && offset === 0
      ? "bg-accent/10 text-accent"
      : "bg-bg-tertiary text-text-tertiary";
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

/** 单条任务行：完成勾选、标题（完成删除线）、截止徽标、优先级旗帜。点击进入编辑器。 */
export function TaskRow({ task, onToggle, onOpenEditor }: TaskRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-bg-tertiary sm:min-h-0 sm:gap-2 sm:rounded-md sm:px-2 sm:py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.title}
        onClick={onToggle}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors sm:h-4.5 sm:w-4.5 ${task.done ? "border-accent bg-accent text-white" : "border-text-tertiary hover:border-accent"}`}
      >
        <Check size={13} strokeWidth={3} aria-hidden="true" className="sm:hidden" />
        <Check size={11} strokeWidth={3} aria-hidden="true" className="hidden sm:block" />
      </button>
      <button
        type="button"
        onClick={onOpenEditor}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-base ${task.done ? "text-text-tertiary line-through" : "text-text-primary"} sm:text-sm`}>
            {task.title}
          </span>
          {task.description ? (
              <span className="mt-0.5 block truncate text-sm leading-5 text-text-tertiary sm:mt-0.5 sm:text-xs">
                {task.description}
              </span>
            ) : null}
        </span>
        {task.dueDate ? <DueBadge dueDate={task.dueDate} done={task.done} /> : null}
        {task.priority !== "none" ? (
          <Flag size={12} className={`shrink-0 ${PRIORITY_FLAG_CLASS[task.priority]}`} aria-label={t(PRIORITY_LABEL_KEY[task.priority])} />
        ) : null}
      </button>
    </div>
  );
}
