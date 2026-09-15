import { Trash2 } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { DueDateChip, PriorityChip, ReminderChip } from "./TaskMetaControls";

export type { TaskDraft };

interface TaskEditorProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** 任务行内编辑器：替换任务行渲染，chip 设置日期/优先级/提醒，Esc 或点击外部收起。 */
export function TaskEditor({ task, busy, onSave, onDelete, onClose }: TaskEditorProps) {
  const { t } = useTranslation();
  const editor = useTaskEditor({ task, onSave, onClose });

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-default" aria-hidden="true" onPointerDown={editor.close} />
      <div className="relative z-40 mx-1 mb-2 rounded-lg border border-accent/30 bg-bg-primary p-2 shadow-sm">
        <input
          autoFocus
          className="bare-input w-full rounded-md bg-transparent px-1 py-0.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          value={editor.title}
          aria-label={t("todo.taskTitle")}
          onChange={(event) => editor.setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") editor.close();
          }}
        />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <DueDateChip value={editor.dueDate} onChange={editor.commitDueDate} />
          <PriorityChip value={editor.priority} onChange={editor.commitPriority} />
          <ReminderChip
            dueDate={editor.dueDate}
            value={editor.remindValue}
            onToggle={editor.toggleReminder}
            onChange={editor.commitReminder}
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={t("todo.deleteTask")}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
