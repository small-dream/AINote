import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { useTranslation } from "@/i18n";
import { useBackHandler } from "@/platform/back-navigation";
import { useTaskEditor, type TaskDraft } from "../hooks/useTaskEditor";
import { TaskFormCard } from "./TaskFormCard";
import { TaskSaveStatus } from "./TaskSaveStatus";

interface MobileTaskEditorProps {
  task: TaskItemDto;
  busy: boolean;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * 移动端任务编辑面：与「新建任务」同为独立工作面——全屏铺开、键盘自动避让、
 * 底部操作条承载保存状态、删除与「完成」。列表不再被就地展开的编辑器顶走，
 * 系统返回键也接管为「收起编辑面」而不是退出应用。
 */
export function MobileTaskEditor({ task, busy, onSave, onDelete, onClose }: MobileTaskEditorProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const editor = useTaskEditor({ task, onSave, onClose });
  useBackHandler(true, () => { void editor.close(); });

  return (
    <div data-mobile-overlay="task" className="fixed inset-0 z-50 flex bg-bg-primary" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("todo.editTask")}
        className="mx-auto flex h-full w-full max-w-2xl flex-col bg-bg-primary"
      >
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2">
          <button
            type="button"
            aria-label={t("mobile.backToList")}
            onClick={() => { void editor.close(); }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{t("todo.editTask")}</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {/* 不自动聚焦标题：点任务行常常只是想看截止时间或详情，键盘不该先一步盖住刚打开的内容 */}
          <TaskFormCard
            density="pane"
            title={editor.title}
            description={editor.description}
            dueAt={editor.dueAt}
            priority={editor.priority}
            remindAt={editor.remindAt} createdAt={task.createdAt}
            onTitleChange={editor.setTitle}
            onDescriptionChange={editor.setDescription}
            onDueAtChange={editor.commitDueDate}
            onPriorityChange={editor.commitPriority}
            onRemindAtChange={editor.commitReminder}
          />
        </div>
        <TaskEditorActions
          busy={busy}
          editor={editor}
          onRequestDelete={() => setConfirming(true)}
          onDone={() => { void editor.close(); }}
        />
      </div>
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

/** 底部固定操作条：保存状态贴左，删除与「完成」落在拇指区。 */
function TaskEditorActions({ busy, editor, onRequestDelete, onDone }: {
  busy: boolean;
  editor: ReturnType<typeof useTaskEditor>;
  onRequestDelete: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <footer
      className="flex shrink-0 items-center gap-2 border-t border-border px-3 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <TaskSaveStatus className="min-w-0 flex-1" dirty={editor.dirty} status={editor.status} error={editor.error} onRetry={editor.retry} />
      <button
        type="button"
        aria-label={t("todo.deleteTask")}
        disabled={busy}
        onClick={onRequestDelete}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
      <Button className="min-h-11 px-5" onClick={onDone}>{t("todo.done")}</Button>
    </footer>
  );
}
