import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { useTranslation } from "@/i18n";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { TaskFormCard } from "./TaskFormCard";
import { TaskSaveStatus } from "./TaskSaveStatus";

export type { TaskDraft };

interface TaskEditorProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * 桌面侧栏的行内编辑器：替换任务行渲染，chip 设置日期/优先级/提醒，Esc 或点击外部收起。
 * 收起即提交最后一份草稿；标题/详情另有防抖自动保存，底部状态区实时给出保存结果。
 * 顺序与新建弹窗一致：内容（标题 + 详情）在上，元数据 chips、保存状态与删除入口收在卡片底部。
 */
export function TaskEditor({ task, busy, onSave, onDelete, onClose }: TaskEditorProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const editor = useTaskEditor({ task, onSave, onClose });

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-default" aria-hidden="true" onPointerDown={() => { void editor.close(); }} />
      <TaskFormCard
        density="inline"
        className="relative z-40 mx-1 mb-2"
        autoFocusTitle
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
        onTitleKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === "Escape") void editor.close();
        }}
        metaTrailing={
          <>
            <TaskSaveStatus dirty={editor.dirty} status={editor.status} error={editor.error} onRetry={editor.retry} />
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              aria-label={t("todo.deleteTask")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50 sm:h-6 sm:w-6 sm:rounded-md"
            >
              <Trash2 size={15} aria-hidden="true" className="sm:hidden" />
              <Trash2 size={13} aria-hidden="true" className="hidden sm:block" />
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
    </>
  );
}
