import { useState } from "react";
import { ListTodo } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";

const INPUT_CLASS = "rounded-md border border-border bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent";

/** 快捷新增任务：Enter 创建到当前清单。 */
export function QuickAdd({ busy, onAdd }: { busy: boolean; onAdd: (title: string) => void }) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [value, setValue] = useState("");

  function submit(): void {
    const title = value.trim();
    if (!title) {
      pushToast(t("todo.titleRequired"), "error");
      return;
    }
    onAdd(title);
    setValue("");
  }

  return (
    <div className="shrink-0 border-b border-border px-3 py-2">
      <input
        className={`${INPUT_CLASS} w-full`}
        placeholder={t("todo.addTaskPlaceholder")}
        aria-label={t("todo.addTaskPlaceholder")}
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
      />
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
    <div className="mx-3 mt-6 rounded-lg border border-dashed border-border px-4 py-6 text-center">
      <ListTodo size={20} className="mx-auto text-text-tertiary" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-text-primary">{t("todo.emptyTitle")}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{t("todo.emptyHint")}</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          className={`${INPUT_CLASS} min-w-0 flex-1`}
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
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:brightness-95 disabled:opacity-50"
        >
          {t("todo.createFirstList")}
        </button>
      </div>
    </div>
  );
}
