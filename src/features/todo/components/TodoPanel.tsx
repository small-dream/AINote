import { useState } from "react";
import type { CreateTaskInput } from "@/api";
import { useTranslation } from "@/i18n";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskEditor } from "./TaskEditor";
import { TaskRow } from "./TaskRow";
import { TodoListHeader } from "./TodoListHeader";
import { TodoTaskList } from "./TodoTaskList";

/** 侧边栏待办面板（桌面侧栏与移动端共用）：任务流 + 行内编辑 + 新建任务弹窗。 */
export function TodoPanel({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const { data: board, isLoading } = useTaskBoardQuery(repoPath);
  const mutations = useTaskMutations();
  const [creating, setCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const tasks = board?.tasks ?? [];

  function createTask(draft: CreateTaskInput): void {
    mutations.create.mutate(draft, { onSuccess: () => setCreating(false) });
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
          renderTask={(task) => task.id === editingTaskId ? (
            <TaskEditor
              key={`${task.id}:${task.updatedAt}`}
              task={task}
              busy={mutations.busy}
              onSave={(draft) => mutations.update.mutate({ taskId: task.id, ...draft })}
              onDelete={() => { mutations.remove.mutate(task.id); setEditingTaskId(null); }}
              onClose={() => setEditingTaskId(null)}
            />
          ) : (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => mutations.toggle.mutate(task.id)}
              onOpenEditor={() => setEditingTaskId((current) => (current === task.id ? null : task.id))}
            />
          )}
        />
      )}
      {creating ? (
        <TaskCreateDialog busy={mutations.busy} onClose={() => setCreating(false)} onCreate={createTask} />
      ) : null}
    </div>
  );
}
