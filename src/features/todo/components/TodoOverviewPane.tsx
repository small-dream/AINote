import { CalendarClock, CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import type { TaskItemDto } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useMemo } from "react";
import { buildTodoOverview } from "../utils/overview";
import { DueBadge } from "./TaskRow";

interface TodoOverviewPaneProps {
  tasks: TaskItemDto[];
  listName: string;
  hasLists: boolean;
  onSelectTask: (taskId: string) => void;
}

export function TodoOverviewPane({ tasks, listName, hasLists, onSelectTask }: TodoOverviewPaneProps) {
  const { t } = useTranslation();
  const overview = useMemo(() => buildTodoOverview(tasks, new Date()), [tasks]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-bg-primary px-8 py-7">
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("todo.title")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">{listName}</h1>
        {!hasLists ? (
          <p className="mt-2 text-sm text-text-secondary">{t("todo.emptyHint")}</p>
        ) : tasks.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">{t("todo.overviewEmpty")}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OverviewCard icon={CircleDashed} label={t("todo.openTasks")} value={overview.open} tone="text-accent" />
          <OverviewCard icon={CheckCircle2} label={t("todo.completedTasks")} value={overview.done} tone="text-success" />
          <OverviewCard icon={CalendarClock} label={t("todo.dueToday")} value={overview.dueToday} tone="text-warning" />
          <OverviewCard icon={TriangleAlert} label={t("todo.groupOverdue")} value={overview.overdue} tone="text-danger" />
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-bg-secondary p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-text-primary">{t("todo.progress")}</span>
            <span className="text-text-secondary">{overview.progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${overview.progress}%` }} />
          </div>
        </section>

        <FocusSection
          title={t("todo.focusTasks")}
          tasks={overview.focusTasks}
          empty={t("todo.noFocusTasks")}
          onSelectTask={onSelectTask}
        />
        {overview.focusTasks.length === 0 ? (
          <FocusSection
            title={t("todo.groupUpcoming")}
            tasks={overview.upcomingTasks}
            empty={t("todo.noUpcomingTasks")}
            onSelectTask={onSelectTask}
          />
        ) : null}
      </div>
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value, tone }: { icon: typeof CircleDashed; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Icon size={14} className={tone} aria-hidden="true" />
        {label}
      </div>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function FocusSection({ title, tasks, empty, onSelectTask }: { title: string; tasks: TaskItemDto[]; empty: string; onSelectTask: (taskId: string) => void }) {
  return (
    <section className="mt-5">
      <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      {tasks.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-tertiary">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {tasks.map((task) => (
            <button key={task.id} type="button" onClick={() => onSelectTask(task.id)} className="rounded-2xl border border-border bg-bg-secondary p-4 text-left transition-colors hover:border-accent">
              <p className="font-medium text-text-primary">{task.title}</p>
              {task.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-tertiary">{task.description}</p> : null}
              <div className="mt-3 flex items-center gap-2">
                {task.dueDate ? <DueBadge dueDate={task.dueDate} done={task.done} /> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
