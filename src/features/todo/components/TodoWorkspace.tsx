import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import {
  useTaskBoardQuery,
  useTaskCreateListMutation,
  useTaskCreateMutation,
  useTaskDeleteListMutation,
  useTaskDeleteMutation,
  useTaskRenameListMutation,
  useTaskToggleMutation,
  useTaskUpdateMutation,
} from "@/queries/task.queries";
import { useTodoPanel } from "../hooks/useTodoPanel";
import { groupTasks, localDateString, type TaskGroup, type TaskGroupSection } from "../utils/task";
import { ListBar } from "./ListBar";
import { TaskRow } from "./TaskRow";
import { TodoOverviewPane } from "./TodoOverviewPane";
import { TaskDetailPane } from "./TaskDetailPane";
import { EmptyLists, QuickAdd, type QuickAddDraft } from "./TodoForms";

const GROUP_LABEL_KEY: Record<TaskGroup, TranslationKey> = {
  overdue: "todo.groupOverdue",
  today: "todo.groupToday",
  upcoming: "todo.groupUpcoming",
  none: "todo.groupNone",
  done: "todo.groupDone",
};

interface TaskMutations {
  createList: ReturnType<typeof useTaskCreateListMutation>;
  renameList: ReturnType<typeof useTaskRenameListMutation>;
  deleteList: ReturnType<typeof useTaskDeleteListMutation>;
  createTask: ReturnType<typeof useTaskCreateMutation>;
  updateTask: ReturnType<typeof useTaskUpdateMutation>;
  toggleTask: ReturnType<typeof useTaskToggleMutation>;
  deleteTask: ReturnType<typeof useTaskDeleteMutation>;
}

/** 桌面待办工作区：左侧清单与任务，右侧使用主内容区编辑详情。 */
export function TodoWorkspace({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const { data: board, isLoading } = useTaskBoardQuery(repoPath);
  const panel = useTodoPanel(board);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const mutations = useTaskBoardMutations();
  const busy = Object.values(mutations).some((mutation) => mutation.isPending);
  const tasks = board?.tasks.filter((task) => task.listId === panel.activeListId) ?? [];
  const selectedTask = board?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeList = board?.lists.find((list) => list.id === panel.activeListId) ?? null;
  const openCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of board?.tasks ?? []) {
      if (!task.done) counts[task.listId] = (counts[task.listId] ?? 0) + 1;
    }
    return counts;
  }, [board]);

  return (
    <div className="workspace-todo flex h-full min-h-0 flex-1 overflow-hidden bg-bg-primary">
      <aside className="workspace-todo-list flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r border-border bg-bg-secondary">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("todo.title")}</span>
          <span className="text-xs text-text-tertiary">{tasks.filter((task) => !task.done).length}</span>
        </header>
        {isLoading ? (
          <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>
        ) : panel.lists.length === 0 ? (
          <EmptyLists busy={mutations.createList.isPending} onCreate={(name) => mutations.createList.mutate(name)} />
        ) : (
          <TaskListPane
            panel={panel}
            tasks={tasks}
            openCounts={openCounts}
            mutations={mutations}
            busy={busy}
            onSelectTask={setSelectedTaskId}
          />
        )}
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary" aria-label={t("todo.details")}>
        {selectedTask ? (
          <TaskDetailPane
            task={selectedTask}
            busy={busy}
            onSave={(draft) => mutations.updateTask.mutate({ taskId: selectedTask.id, listId: selectedTask.listId, ...draft })}
            onDelete={() => { mutations.deleteTask.mutate(selectedTask.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
          />
        ) : (
          <TodoOverviewPane
            tasks={tasks}
            listName={activeList?.name ?? t("todo.title")}
            hasLists={panel.lists.length > 0}
            onSelectTask={setSelectedTaskId}
          />
        )}
      </section>
    </div>
  );
}

function useTaskBoardMutations(): TaskMutations {
  return {
    createList: useTaskCreateListMutation(),
    renameList: useTaskRenameListMutation(),
    deleteList: useTaskDeleteListMutation(),
    createTask: useTaskCreateMutation(),
    updateTask: useTaskUpdateMutation(),
    toggleTask: useTaskToggleMutation(),
    deleteTask: useTaskDeleteMutation(),
  };
}

interface TaskListPaneProps {
  panel: ReturnType<typeof useTodoPanel>;
  tasks: TaskItemDto[];
  openCounts: Record<string, number>;
  mutations: TaskMutations;
  busy: boolean;
  onSelectTask: (taskId: string) => void;
}

function TaskListPane({ panel, tasks, openCounts, mutations, busy, onSelectTask }: TaskListPaneProps) {
  const { t } = useTranslation();
  const sections = groupTasks(tasks, localDateString(new Date()));

  return (
    <>
      <ListBar
        lists={panel.lists}
        counts={openCounts}
        activeListId={panel.activeListId}
        busy={busy}
        onSelect={panel.selectList}
        onCreate={(name) => mutations.createList.mutate(name)}
        onRename={(listId, name) => mutations.renameList.mutate({ listId, name })}
        onDelete={(listId) => mutations.deleteList.mutate(listId)}
      />
      {panel.activeListId ? (
        <QuickAdd
          busy={busy}
          onAdd={(draft: QuickAddDraft) => mutations.createTask.mutate({ listId: panel.activeListId ?? "", ...draft, remindAt: null })}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-bg-tertiary text-text-tertiary">
              <ListTodo size={18} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-text-secondary">{t("todo.listEmpty")}</p>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">{t("todo.listEmptyHint")}</p>
          </div>
        ) : (
          sections.map((section) => (
            <TaskGroups
              key={section.group}
              section={section}
              onToggle={(task) => mutations.toggleTask.mutate(task.id)}
              onSelectTask={onSelectTask}
            />
          ))
        )}
      </div>
    </>
  );
}

interface TaskGroupsProps {
  section: TaskGroupSection;
  onToggle: (task: TaskItemDto) => void;
  onSelectTask: (taskId: string) => void;
}

function TaskGroups({ section, onToggle, onSelectTask }: TaskGroupsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (section.tasks.length === 0) return null;
  const collapsible = section.group === "done";
  const expanded = !collapsible || open;
  return (
    <section className="mb-1">
      <button type="button" onClick={collapsible ? () => setOpen((value) => !value) : undefined} className={`flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary ${collapsible ? "hover:text-text-secondary" : "cursor-default"}`}>
        {collapsible ? (open ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />) : null}
        {t(GROUP_LABEL_KEY[section.group])}
        <span className="normal-case">{section.tasks.length}</span>
      </button>
      {expanded ? section.tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={() => onToggle(task)} onOpenEditor={() => onSelectTask(task.id)} />
      )) : null}
    </section>
  );
}
