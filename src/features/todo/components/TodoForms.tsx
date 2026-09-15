import { useMemo, useState } from "react";
import { ArrowUp, FileText, ListTodo } from "lucide-react";
import type { TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { parseTaskInput } from "../utils/task";
import { DueDateChip, PriorityChip } from "./TaskMetaControls";

export interface QuickAddDraft {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TaskPriority;
}

function DetailsToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t("todo.toggleDetails")}
      aria-expanded={open}
      onClick={onToggle}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-bg-tertiary sm:h-6 sm:w-6 sm:rounded-md ${open ? "text-accent" : "text-text-tertiary"}`}
    >
      <FileText size={15} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function DetailsField({ value, disabled, onChange, onSubmit }: { value: string; disabled: boolean; onChange: (value: string) => void; onSubmit: () => void }) {
  const { t } = useTranslation();
  return (
    <textarea
      className="bare-textarea min-h-24 w-full resize-none border-0 bg-transparent px-3 pb-2 pt-2 text-base leading-6 text-text-primary outline-none placeholder:text-text-tertiary focus:outline-none sm:min-h-20 sm:text-sm"
      value={value}
      placeholder={t("todo.detailsPlaceholder")}
      aria-label={t("todo.details")}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit(); }}
    />
  );
}

/** 快捷新增任务：标题内识别「明天 / 周五 / p1」等日期与优先级，chip 可手动覆盖。 */
export function QuickAdd({ busy, onAdd }: { busy: boolean; onAdd: (draft: QuickAddDraft) => void }) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dueOverride, setDueOverride] = useState<string | null>(null);
  const [priorityOverride, setPriorityOverride] = useState<TaskPriority | null>(null);

  const parsed = useMemo(() => parseTaskInput(value, new Date()), [value]);
  const dueDate = dueOverride ?? parsed.dueDate;
  const priority = priorityOverride ?? parsed.priority;
  const canSubmit = value.trim().length > 0 && !busy;

  function submit(): void {
    if (!value.trim()) {
      pushToast(t("todo.titleRequired"), "error");
      return;
    }
    onAdd({ title: parsed.title, description: description.trim(), dueDate, priority });
    setValue("");
    setDescription("");
    setDetailsOpen(false);
    setDueOverride(null);
    setPriorityOverride(null);
  }

  return (
    <div className="shrink-0 border-b border-border bg-bg-secondary p-2 sm:p-3">
      <div className="overflow-hidden rounded-lg border border-border bg-bg-primary shadow-sm transition-all focus-within:border-accent/70 focus-within:shadow-[0_0_0_3px_var(--accent-soft)] sm:rounded-xl">
        <input
          className="bare-input w-full bg-transparent px-3 pb-2 pt-3 text-base leading-6 text-text-primary outline-none placeholder:text-text-tertiary sm:text-sm"
          aria-label={t("todo.addTask")}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
        />
        {detailsOpen ? (
          <DetailsField value={description} disabled={busy} onChange={setDescription} onSubmit={submit} />
        ) : null}
        <div className="flex items-center gap-1 border-t border-border/70 bg-bg-secondary/50 px-2 py-1.5">
          <DueDateChip value={dueDate} onChange={setDueOverride} />
          <PriorityChip value={priority} onChange={setPriorityOverride} />
          <div className="flex-1" />
          <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)} />
          <button
            type="button"
            aria-label={t("todo.addTask")}
            onClick={submit}
            disabled={!canSubmit}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-white shadow-sm transition-all hover:brightness-95 active:scale-95 disabled:opacity-40 sm:h-6.5 sm:w-6.5"
          >
            <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" className="sm:hidden" />
            <ArrowUp size={14} strokeWidth={2.5} aria-hidden="true" className="hidden sm:block" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 无清单空态：引导创建第一个清单。 */
export function EmptyLists({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [value, setValue] = useState("");

  function submit(): void {
    const name = value.trim();
    if (!name) {
      pushToast(t("todo.listNameRequired"), "error");
      return;
    }
    onCreate(name);
    setValue("");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
        <ListTodo size={20} aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-text-primary">{t("todo.emptyTitle")}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{t("todo.emptyHint")}</p>
      <div className="mt-4 w-full max-w-72 sm:max-w-56">
        <input
          className="h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent sm:h-9 sm:rounded-md sm:px-2.5 sm:text-sm"
          placeholder={t("todo.listNamePlaceholder")}
          aria-label={t("todo.listNamePlaceholder")}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-2 h-10 w-full rounded-lg bg-accent px-3 text-sm text-white transition-colors hover:brightness-95 disabled:opacity-50 sm:rounded-md sm:py-1.5 sm:text-sm"
        >
          {t("todo.createFirstList")}
        </button>
      </div>
    </div>
  );
}
