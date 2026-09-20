import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { TaskFormCard } from "./TaskFormCard";
import { TaskSaveStatus } from "./TaskSaveStatus";

interface TaskDetailPaneProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

/** 桌面主区任务详情：与侧栏行内编辑器共用同一份草稿编排，失焦即落盘，状态区给出保存结果。 */
export function TaskDetailPane({ task, busy, onSave, onDelete, onClose }: TaskDetailPaneProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const editor = useTaskEditor({ task, onSave, onClose });
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={() => { void editor.close(); }}
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
        onTitleChange={editor.setTitle}
        onDescriptionChange={editor.setDescription}
        onDueAtChange={editor.commitDueDate}
        onPriorityChange={editor.commitPriority}
        onRemindAtChange={editor.commitReminder}
        onTitleKeyDown={(event) => { if (event.key === "Escape") void editor.close(); }}
        onTitleBlur={editor.save}
        onDescriptionBlur={editor.save}
        metaTrailing={
          <>
            <TaskSaveStatus dirty={editor.dirty} status={editor.status} error={editor.error} onRetry={editor.retry} />
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="rounded-md px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              {t("todo.deleteTask")}
            </button>
          </>
        }
      />
      <ConfirmDialog
        open={confirming}
        title={t("todo.deleteTask")}
        busy={busy}
        danger
        onClose={() => setConfirming(false)}
        onConfirm={onDelete}
      >
        {t("todo.deleteConfirm", { name: task.title })}
      </ConfirmDialog>
    </div>
  );
}
