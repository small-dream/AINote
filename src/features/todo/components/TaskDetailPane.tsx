import type { TaskItemDto } from "@/api/types";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { DueDateChip, DueTimeChip, PriorityChip, ReminderChip } from "./TaskMetaControls";

interface TaskDetailPaneProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailPane({ task, busy, onSave, onDelete, onClose }: TaskDetailPaneProps) {
  const { t } = useTranslation();
  const editor = useTaskEditor({ task, onSave, onClose });
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={editor.close}
        className="mb-3 flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {t("todo.backToOverview")}
      </button>
      <input
        className="bare-input w-full bg-transparent px-0 pb-2 text-xl font-semibold text-text-primary outline-none"
        value={editor.title}
        aria-label={t("todo.taskTitle")}
        onChange={(event) => editor.setTitle(event.target.value)}
        onBlur={editor.save}
        onKeyDown={(event) => { if (event.key === "Escape") editor.close(); }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DueDateChip value={editor.dueAt} onChange={editor.commitDueDate} />
        <DueTimeChip dueAt={editor.dueAt} onChange={editor.commitDueDate} />
        <PriorityChip value={editor.priority} onChange={editor.commitPriority} />
        <ReminderChip dueAt={editor.dueAt} value={editor.remindAt} onChange={editor.commitReminder} />
        <div className="flex-1" />
        <button type="button" onClick={onDelete} disabled={busy} className="rounded-md px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50">
          {t("todo.deleteTask")}
        </button>
      </div>
      {/* 聚焦态交给外层容器：避免与全局 focus-visible 外框叠成双层描边 */}
      <div className="mt-4 min-h-[45vh] rounded-xl border border-border bg-bg-primary transition-colors focus-within:border-accent">
        <textarea
          className="bare-textarea block min-h-[45vh] w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-tertiary"
          value={editor.description}
          placeholder={t("todo.detailsPlaceholder")}
          aria-label={t("todo.details")}
          onChange={(event) => editor.setDescription(event.target.value)}
          onBlur={editor.save}
        />
      </div>
    </div>
  );
}
