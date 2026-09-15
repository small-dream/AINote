import type { TaskItemDto } from "@/api/types";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { TaskFormCard } from "./TaskFormCard";

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
      <TaskFormCard
        density="pane"
        className="mt-3"
        title={editor.title}
        description={editor.description}
        dueAt={editor.dueAt}
        priority={editor.priority}
        remindAt={editor.remindAt}
        disabled={busy}
        onTitleChange={editor.setTitle}
        onDescriptionChange={editor.setDescription}
        onDueAtChange={editor.commitDueDate}
        onPriorityChange={editor.commitPriority}
        onRemindAtChange={editor.commitReminder}
        onTitleKeyDown={(event) => { if (event.key === "Escape") editor.close(); }}
        onTitleBlur={editor.save}
        onDescriptionBlur={editor.save}
        metaTrailing={
          <button type="button" onClick={onDelete} disabled={busy} className="rounded-md px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50">
            {t("todo.deleteTask")}
          </button>
        }
      />
    </div>
  );
}
