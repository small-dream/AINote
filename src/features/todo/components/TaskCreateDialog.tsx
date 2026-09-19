import type { CreateTaskInput } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { useNewTaskDraft } from "../hooks/useNewTaskDraft";
import { TaskFormCard } from "./TaskFormCard";

interface TaskCreateDialogProps {
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: CreateTaskInput) => void;
}

/**
 * 新建任务弹窗：标题保留自然语言识别（「明天 周五 p1」），
 * 截止日期、优先级、提醒与详情在同一面板内一次设完；打开即聚焦标题，Enter 直接创建。
 * 卡片内顺序为「内容（标题 + 详情）→ 元数据 chips」，属性条贴近底部操作栏，提交前一眼可查。
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
      {/* 与行内编辑器、桌面详情共用同一张卡：聚焦态由卡片高亮，输入框本身不再叠加全局焦点外框 */}
      <TaskFormCard
        density="dialog"
        autoFocusTitle
        title={draft.title}
        titlePlaceholder={t("todo.addTaskPlaceholder")}
        description={draft.description}
        dueAt={draft.dueAt}
        priority={draft.priority}
        remindAt={draft.remindAt}
        disabled={busy}
        onTitleChange={draft.setTitle}
        onDescriptionChange={draft.setDescription}
        onDueAtChange={draft.changeDueAt}
        onPriorityChange={draft.setPriority}
        onRemindAtChange={draft.setRemindAt}
        onTitleKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) submit(); }}
        onDescriptionKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) submit(); }}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={submit} disabled={busy || !draft.valid}>
          {busy ? t("common.saving") : t("todo.addTask")}
        </Button>
      </div>
    </Modal>
  );
}
