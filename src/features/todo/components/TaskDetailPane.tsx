import type { TaskItemDto } from "@/api/types";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { DueDateChip, PriorityChip, ReminderChip } from "./TaskMetaControls";

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
        <DueDateChip value={editor.dueDate} onChange={editor.commitDueDate} />
        <PriorityChip value={editor.priority} onChange={editor.commitPriority} />
        <ReminderChip
          dueDate={editor.dueDate}
          value={editor.remindValue}
          onToggle={editor.toggleReminder}
          onChange={editor.commitReminder}
        />
        <div className="flex-1" />
        <button type="button" onClick={onDelete} disabled={busy} className="rounded-md px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50">
          {t("todo.deleteTask")}
        </button>
      </div>
      <textarea
        className="mt-4 min-h-[45vh] w-full resize-none rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
        value={editor.description}
        placeholder={t("todo.detailsPlaceholder")}
        aria-label={t("todo.details")}
        onChange={(event) => editor.setDescription(event.target.value)}
        onBlur={editor.save}
      />
    </div>
  );
}
