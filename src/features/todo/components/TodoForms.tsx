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
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-bg-tertiary ${open ? "text-accent" : "text-text-tertiary"}`}
    >
      <FileText size={13} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function DetailsField({ value, disabled, onChange, onSubmit }: { value: string; disabled: boolean; onChange: (value: string) => void; onSubmit: () => void }) {
  const { t } = useTranslation();
  return (
    <textarea
      className="mt-1.5 min-h-20 w-full resize-none rounded-md border border-border bg-bg-secondary px-2 py-1.5 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
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
    <div className="shrink-0 border-b border-border p-2">
      <div className="rounded-lg border border-border bg-bg-primary transition-colors focus-within:border-accent">
        <input
          className="bare-input w-full bg-transparent px-2.5 pb-1 pt-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          placeholder={t("todo.addTaskPlaceholder")}
          aria-label={t("todo.addTask")}
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <DueDateChip value={dueDate} onChange={setDueOverride} />
          <PriorityChip value={priority} onChange={setPriorityOverride} />
          <div className="flex-1" />
          <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)} />
          <button
            type="button"
            aria-label={t("todo.addTask")}
            onClick={submit}
            disabled={!canSubmit}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-white transition-all hover:brightness-95 active:scale-95 disabled:opacity-40"
          >
            <ArrowUp size={13} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        {detailsOpen ? (
          <DetailsField value={description} disabled={busy} onChange={setDescription} onSubmit={submit} />
        ) : null}
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
      <div className="mt-4 w-full max-w-56">
        <input
          className="w-full rounded-md border border-border bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent"
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
          className="mt-2 w-full rounded-md bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:brightness-95 disabled:opacity-50"
        >
          {t("todo.createFirstList")}
        </button>
      </div>
    </div>
  );
}
