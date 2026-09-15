import { Plus } from "lucide-react";
import { useTranslation } from "@/i18n";

interface TodoListHeaderProps {
  /** 未完成任务数 */
  openCount: number;
  busy: boolean;
  onCreate: () => void;
}

/** 待办列表头：标题 + 未完成计数 + 唯一的「新建任务」入口。 */
export function TodoListHeader({ openCount, busy, onCreate }: TodoListHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("todo.title")}</span>
      <span className="text-xs text-text-tertiary">{openCount}</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent transition-colors hover:bg-bg-tertiary disabled:opacity-50 sm:h-7 sm:px-1.5 sm:text-xs"
      >
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        {t("todo.newTask")}
      </button>
    </header>
  );
}
