import type { CreateTaskInput } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { useNewTaskDraft } from "../hooks/useNewTaskDraft";
import { DueDateChip, DueTimeChip, PriorityChip, ReminderChip } from "./TaskMetaControls";

interface TaskCreateDialogProps {
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: CreateTaskInput) => void;
}

/**
 * 新建任务弹窗：标题保留自然语言识别（「明天 周五 p1」），
 * 截止日期、优先级、提醒与详情在同一面板内一次设完；打开即聚焦标题，Enter 直接创建。
 * 由调用方在打开时挂载，关闭即卸载，避免残留上一次的草稿。
 */
export function TaskCreateDialog({ busy, onClose, onCreate }: TaskCreateDialogProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const draft = useNewTaskDraft();

  function submit(): void {
    if (!draft.valid) {
      pushToast(t("todo.titleRequired"), "error");
      return;
    }
    onCreate(draft.toInput());
  }

  return (
    <Modal open title={t("todo.newTask")} onClose={busy ? () => undefined : onClose}>
      {/* 标题 + 元数据 + 详情共用一张卡片：聚焦态由外层高亮，输入框本身不再叠加全局焦点外框 */}
      <div className="overflow-hidden rounded-xl border border-border bg-bg-primary transition-colors focus-within:border-accent/70 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <input
          autoFocus
          className="bare-input w-full bg-transparent px-3 pb-1.5 pt-3 text-base leading-6 text-text-primary placeholder:text-text-tertiary sm:text-sm"
          placeholder={t("todo.addTaskPlaceholder")}
          aria-label={t("todo.taskTitle")}
          value={draft.title}
          disabled={busy}
          onChange={(event) => draft.setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
        />
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <DueDateChip value={draft.dueAt} onChange={draft.changeDueAt} />
          <DueTimeChip dueAt={draft.dueAt} onChange={draft.changeDueAt} />
          <PriorityChip value={draft.priority} onChange={draft.setPriority} />
          <ReminderChip dueAt={draft.dueAt} value={draft.remindAt} onChange={draft.setRemindAt} />
        </div>
        <div className="border-t border-border/70">
          <textarea
            className="bare-textarea min-h-32 w-full resize-none bg-transparent px-3 py-2.5 text-base leading-6 text-text-primary placeholder:text-text-tertiary sm:min-h-36 sm:text-sm"
            placeholder={t("todo.detailsPlaceholder")}
            aria-label={t("todo.details")}
            value={draft.description}
            disabled={busy}
            onChange={(event) => draft.setDescription(event.target.value)}
            onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit(); }}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={submit} disabled={busy || !draft.valid}>
          {busy ? t("common.saving") : t("todo.addTask")}
        </Button>
      </div>
    </Modal>
  );
}
