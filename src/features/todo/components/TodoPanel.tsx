import { useState } from "react";
import type { CreateTaskInput } from "@/api";
import type { TaskItemDto } from "@/api/types";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useTranslation } from "@/i18n";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { useUiStore } from "@/stores/ui.store";
import type { TaskDraft } from "../hooks/useTaskEditor";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { MobileTaskEditor } from "./MobileTaskEditor";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskEditor } from "./TaskEditor";
import { TaskRow } from "./TaskRow";
import { TodoListHeader } from "./TodoListHeader";
import { TodoTaskList } from "./TodoTaskList";

type TaskSaveMutation = ReturnType<typeof useTaskMutations>["save"];

/** 编辑器自动保存：错误由卡片内的保存状态区呈现（带重试），不再叠加全局 toast。 */
function autoSave(save: TaskSaveMutation, taskId: string) {
  return async (draft: TaskDraft): Promise<void> => {
    await save.mutateAsync({ taskId, ...draft });
  };
}

/**
 * 侧边栏待办面板（桌面侧栏与移动端列表共用）：任务流 + 新建任务弹窗。
 * 编辑形态按视口分流——桌面在列表里原地展开行内编辑器，移动端进入独立的全屏编辑面，
 * 让「编辑一条任务」和「新建一条任务」在手机上有同样的空间与返回路径。
 */
export function TodoPanel({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const { data: board, isLoading } = useTaskBoardQuery(repoPath);
  const mutations = useTaskMutations();
  const isMobile = useIsMobileViewport();
  const [creating, setCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const tasks = board?.tasks ?? [];
  const focusedTaskId = useUiStore((state) => state.focusedTaskId);
  // 提醒卡片的「查看任务」优先于上一次展开的编辑卡片
  const activeTask = tasks.find((task) => task.id === (focusedTaskId ?? editingTaskId)) ?? null;

  function openTask(taskId: string | null): void {
    useUiStore.getState().clearFocusedTask();
    setEditingTaskId(taskId);
  }

  function dropTask(taskId: string): void {
    mutations.remove.mutate(taskId);
    openTask(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TodoListHeader
        openCount={tasks.filter((task) => !task.done).length}
        busy={mutations.busy}
        onCreate={() => setCreating(true)}
      />
      {isLoading ? (
        <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>
      ) : (
        <TodoTaskList
          tasks={tasks}
          renderTask={(task) => (
            <TaskEntry
              key={task.id}
              task={task}
              editing={!isMobile && task.id === activeTask?.id}
              busy={mutations.busy}
              onToggle={() => mutations.toggle.mutate(task.id)}
              onOpen={() => openTask(task.id)}
              onSave={autoSave(mutations.save, task.id)}
              onDelete={() => dropTask(task.id)}
              onClose={() => openTask(null)}
            />
          )}
        />
      )}
      {isMobile && activeTask ? (
        <MobileEditor task={activeTask} busy={mutations.busy} save={mutations.save} onDelete={dropTask} onClose={() => openTask(null)} />
      ) : null}
      {creating ? (
        <TaskCreateDialog
          busy={mutations.busy}
          onClose={() => setCreating(false)}
          onCreate={(draft: CreateTaskInput) => mutations.create.mutate(draft, { onSuccess: () => setCreating(false) })}
        />
      ) : null}
    </div>
  );
}

interface TaskEntryProps {
  task: TaskItemDto;
  editing: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSave: (draft: TaskDraft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * 单条任务在列表里的形态：桌面展开为行内编辑器，其余情况只是一行可点的任务。
 * 列表按 task.id 建 key——自动保存会让 updatedAt 反复变化，带上它会把编辑器连焦点一起重建。
 */
function TaskEntry({ task, editing, busy, onToggle, onOpen, onSave, onDelete, onClose }: TaskEntryProps) {
  if (editing) {
    return <TaskEditor task={task} busy={busy} onSave={onSave} onDelete={onDelete} onClose={onClose} />;
  }
  return <TaskRow task={task} onToggle={onToggle} onOpenEditor={onOpen} />;
}

/** 移动端编辑面：挂在列表外层，用独立工作面替代列表内的就地展开。 */
function MobileEditor({ task, busy, save, onDelete, onClose }: {
  task: TaskItemDto | null;
  busy: boolean;
  save: TaskSaveMutation;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}) {
  if (!task) return null;
  return (
    <MobileTaskEditor
      key={task.id}
      task={task}
      busy={busy}
      onSave={autoSave(save, task.id)}
      onDelete={() => onDelete(task.id)}
      onClose={onClose}
    />
  );
}
