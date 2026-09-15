import type { KeyboardEventHandler, ReactNode } from "react";
import type { TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import { DueDateChip, DueTimeChip, PriorityChip, ReminderChip } from "./TaskMetaControls";

/**
 * 任务卡片的视觉密度：
 * - `dialog` 新建弹窗（宽松内边距，卡片自带聚焦高亮）
 * - `inline` 行内编辑器（紧凑，删除入口在 chips 行右端）
 * - `pane` 桌面主区详情（大标题 + 高详情区）
 */
export type TaskFormDensity = "dialog" | "inline" | "pane";

interface TaskFormCardProps {
  density?: TaskFormDensity;
  /** 供调用方补充定位/外边距等容器样式 */
  className?: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: TaskPriority;
  remindAt: string | null;
  titlePlaceholder?: string;
  autoFocusTitle?: boolean;
  disabled?: boolean;
  /** chips 行右端附加内容（删除入口等） */
  metaTrailing?: ReactNode;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDueAtChange: (value: string | null) => void;
  onPriorityChange: (value: TaskPriority) => void;
  onRemindAtChange: (value: string | null) => void;
  onTitleKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onDescriptionKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onTitleBlur?: () => void;
  onDescriptionBlur?: () => void;
}

const CARD_CLASS: Record<TaskFormDensity, string> = {
  dialog:
    "overflow-hidden rounded-xl border border-border bg-bg-primary transition-colors focus-within:border-accent/70 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
  inline: "rounded-lg border border-accent/30 bg-bg-primary p-3 shadow-sm sm:p-2",
  pane: "rounded-xl border border-border bg-bg-primary transition-colors focus-within:border-accent",
};

const TITLE_CLASS: Record<TaskFormDensity, string> = {
  dialog: "px-3 pb-1.5 pt-3 text-base leading-6 sm:text-sm",
  inline: "rounded-md px-1 py-1 text-base leading-6 sm:text-sm",
  pane: "px-4 pb-1 pt-4 text-xl font-semibold leading-8",
};

const DETAIL_CLASS: Record<TaskFormDensity, string> = {
  dialog: "min-h-32 px-3 py-2.5 text-base leading-6 sm:min-h-36 sm:text-sm",
  inline: "mt-1 min-h-24 px-1 py-2 text-base leading-6 sm:min-h-20 sm:px-1 sm:py-1.5 sm:text-sm",
  pane: "min-h-[45vh] px-4 py-3 text-sm leading-6",
};

const META_CLASS: Record<TaskFormDensity, string> = {
  dialog: "gap-1 border-t border-border/70 px-2 py-2",
  inline: "mt-2 gap-1 border-t border-border/70 pt-2",
  pane: "mt-3 gap-2 border-t border-border/70 px-4 py-3",
};

/**
 * 任务表单卡片：新建弹窗、行内编辑器、桌面主区详情共用同一张卡。
 * 固定顺序为「内容在上、元数据在下」——标题与详情连续成一块，chips 收在底部分隔线之下。
 */
export function TaskFormCard({
  density = "dialog",
  className = "",
  title,
  description,
  dueAt,
  priority,
  remindAt,
  titlePlaceholder,
  autoFocusTitle = false,
  disabled = false,
  metaTrailing,
  onTitleChange,
  onDescriptionChange,
  onDueAtChange,
  onPriorityChange,
  onRemindAtChange,
  onTitleKeyDown,
  onDescriptionKeyDown,
  onTitleBlur,
  onDescriptionBlur,
}: TaskFormCardProps) {
  const { t } = useTranslation();
  return (
    <div data-task-form={density} className={`${CARD_CLASS[density]} ${className}`}>
      <input
        autoFocus={autoFocusTitle}
        className={`bare-input w-full bg-transparent text-text-primary outline-none placeholder:text-text-tertiary ${TITLE_CLASS[density]}`}
        placeholder={titlePlaceholder}
        aria-label={t("todo.taskTitle")}
        value={title}
        disabled={disabled}
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={onTitleKeyDown}
        onBlur={onTitleBlur}
      />
      <textarea
        className={`bare-textarea block w-full resize-none bg-transparent text-text-primary outline-none placeholder:text-text-tertiary focus:outline-none ${DETAIL_CLASS[density]}`}
        placeholder={t("todo.detailsPlaceholder")}
        aria-label={t("todo.details")}
        value={description}
        disabled={disabled}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onKeyDown={onDescriptionKeyDown}
        onBlur={onDescriptionBlur}
      />
      <div className={`flex flex-wrap items-center ${META_CLASS[density]}`}>
        <DueDateChip value={dueAt} onChange={onDueAtChange} />
        <DueTimeChip dueAt={dueAt} onChange={onDueAtChange} />
        <PriorityChip value={priority} onChange={onPriorityChange} />
        <ReminderChip dueAt={dueAt} value={remindAt} onChange={onRemindAtChange} />
        {metaTrailing ? <div className="flex flex-1 items-center justify-end gap-1">{metaTrailing}</div> : null}
      </div>
    </div>
  );
}
