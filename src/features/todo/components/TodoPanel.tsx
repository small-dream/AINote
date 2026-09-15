import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { TaskEditor, type TaskDraft } from "./TaskEditor";
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

/** 侧边栏 Todo 面板：清单切换 + 分组任务列表 + 行内编辑。 */
export function TodoPanel({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const { data: board, isLoading } = useTaskBoardQuery(repoPath);
  const panel = useTodoPanel(board);
  const mutations: TaskMutations = {
    createList: useTaskCreateListMutation(),
    renameList: useTaskRenameListMutation(),
    deleteList: useTaskDeleteListMutation(),
    createTask: useTaskCreateMutation(),
    updateTask: useTaskUpdateMutation(),
    toggleTask: useTaskToggleMutation(),
    deleteTask: useTaskDeleteMutation(),
  };
  const busy = Object.values(mutations).some((mutation) => mutation.isPending);
  const tasks = board?.tasks.filter((task) => task.listId === panel.activeListId) ?? [];
  const openCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of board?.tasks ?? []) {
      if (!task.done) counts[task.listId] = (counts[task.listId] ?? 0) + 1;
    }
    return counts;
  }, [board]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("todo.title")}</span>
        <span className="text-xs text-text-tertiary">{tasks.filter((task) => !task.done).length}</span>
      </header>
      {isLoading ? (
        <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>
      ) : panel.lists.length === 0 ? (
        <EmptyLists busy={mutations.createList.isPending} onCreate={(name) => mutations.createList.mutate(name)} />
      ) : (
        <TodoBoardContent panel={panel} tasks={tasks} openCounts={openCounts} mutations={mutations} busy={busy} />
      )}
    </div>
  );
}

interface TodoBoardContentProps {
  panel: ReturnType<typeof useTodoPanel>;
  tasks: TaskItemDto[];
  openCounts: Record<string, number>;
  mutations: TaskMutations;
  busy: boolean;
}

function TodoBoardContent({ panel, tasks, openCounts, mutations, busy }: TodoBoardContentProps) {
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
          <p className="px-3 py-4 text-center text-xs text-text-tertiary">{t("todo.listEmpty")}</p>
        ) : (
          sections.map((section) => (
            <TaskGroupView
              key={section.group}
              section={section}
              panel={panel}
              busy={busy}
              onToggle={(task) => mutations.toggleTask.mutate(task.id)}
              onSave={(task, draft) => mutations.updateTask.mutate({ taskId: task.id, listId: task.listId, ...draft })}
              onDelete={(task) => { mutations.deleteTask.mutate(task.id); panel.closeEditor(); }}
            />
          ))
        )}
      </div>
    </>
  );
}

interface TaskGroupViewProps {
  section: TaskGroupSection;
  panel: ReturnType<typeof useTodoPanel>;
  busy: boolean;
  onToggle: (task: TaskItemDto) => void;
  onSave: (task: TaskItemDto, draft: TaskDraft) => void;
  onDelete: (task: TaskItemDto) => void;
}

function TaskGroupView({ section, panel, busy, onToggle, onSave, onDelete }: TaskGroupViewProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (section.tasks.length === 0) return null;
  const collapsible = section.group === "done";
  const expanded = !collapsible || open;

  return (
    <section className="mb-1">
      <button
        type="button"
        onClick={collapsible ? () => setOpen((value) => !value) : undefined}
        className={`flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary ${collapsible ? "hover:text-text-secondary" : "cursor-default"}`}
      >
        {collapsible ? (open ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />) : null}
        {t(GROUP_LABEL_KEY[section.group])}
        <span className="normal-case">{section.tasks.length}</span>
      </button>
      {expanded ? section.tasks.map((task) => (
        panel.editingTaskId === task.id ? (
          <TaskEditor
            key={`${task.id}:${task.updatedAt}`}
            task={task}
            busy={busy}
            onSave={(draft) => onSave(task, draft)}
            onDelete={() => onDelete(task)}
            onClose={panel.closeEditor}
          />
        ) : (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={() => onToggle(task)}
            onOpenEditor={() => panel.toggleEditing(task.id)}
          />
        )
      )) : null}
    </section>
  );
}
