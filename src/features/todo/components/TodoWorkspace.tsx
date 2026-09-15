import { useState } from "react";
import type { CreateTaskInput } from "@/api";
import { useTranslation } from "@/i18n";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskDetailPane } from "./TaskDetailPane";
import { TaskRow } from "./TaskRow";
import { TodoListHeader } from "./TodoListHeader";
import { TodoOverviewPane } from "./TodoOverviewPane";
import { TodoTaskList } from "./TodoTaskList";

/** 桌面待办工作区：左侧任务流，右侧用主内容区展示总览或任务详情。 */
export function TodoWorkspace({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const { data: board, isLoading } = useTaskBoardQuery(repoPath);
  const mutations = useTaskMutations();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const tasks = board?.tasks ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  return (
    <div className="workspace-todo flex h-full min-h-0 flex-1 overflow-hidden bg-bg-primary">
      <aside className="workspace-todo-list flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r border-border bg-bg-secondary">
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
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => mutations.toggle.mutate(task.id)}
                onOpenEditor={() => setSelectedTaskId(task.id)}
              />
            )}
          />
        )}
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary" aria-label={t("todo.details")}>
        {selectedTask ? (
          <TaskDetailPane
            task={selectedTask}
            busy={mutations.busy}
            onSave={(draft) => mutations.update.mutate({ taskId: selectedTask.id, ...draft })}
            onDelete={() => { mutations.remove.mutate(selectedTask.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
          />
        ) : (
          <TodoOverviewPane tasks={tasks} onSelectTask={setSelectedTaskId} />
        )}
      </section>
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
