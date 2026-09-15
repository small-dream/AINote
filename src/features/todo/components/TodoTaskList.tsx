import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { groupTasks, type TaskGroup, type TaskGroupSection } from "../utils/task";

const GROUP_LABEL_KEY: Record<TaskGroup, TranslationKey> = {
  overdue: "todo.groupOverdue",
  today: "todo.groupToday",
  upcoming: "todo.groupUpcoming",
  none: "todo.groupNone",
  done: "todo.groupDone",
};

interface TodoTaskListProps {
  tasks: TaskItemDto[];
  /** 行渲染由调用方决定：侧栏行内编辑、工作区选中查看详情的交互不同。 */
  renderTask: (task: TaskItemDto) => ReactNode;
}

/** 待办任务流：按逾期 / 今天 / 未来 / 无日期 / 已完成分组，桌面侧栏、工作区与移动端共用。 */
export function TodoTaskList({ tasks, renderTask }: TodoTaskListProps) {
  const sections = groupTasks(tasks, new Date());
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
      {tasks.length === 0 ? (
        <EmptyTasks />
      ) : (
        sections.map((section) => <TaskGroup key={section.group} section={section} renderTask={renderTask} />)
      )}
    </div>
  );
}

function TaskGroup({ section, renderTask }: { section: TaskGroupSection; renderTask: (task: TaskItemDto) => ReactNode }) {
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
      {expanded ? section.tasks.map(renderTask) : null}
    </section>
  );
}

function EmptyTasks() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-bg-tertiary text-text-tertiary">
        <ListTodo size={18} aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-text-secondary">{t("todo.emptyTitle")}</p>
      <p className="mt-1 text-xs leading-5 text-text-tertiary">{t("todo.emptyHint")}</p>
    </div>
  );
}
