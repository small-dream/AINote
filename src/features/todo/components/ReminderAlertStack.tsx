import { BellRing, X } from "lucide-react";
import type { TaskPriority } from "@/api/types";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useReminderAlertStore, type ReminderAlertItem } from "@/stores/reminderAlert.store";
import { useReminderAlertActions, type ReminderAlertActions } from "../hooks/useReminderAlertActions";

const PRIORITY_KEYS: Record<TaskPriority, TranslationKey | null> = {
  high: "todo.priorityHigh",
  medium: "todo.priorityMedium",
  low: "todo.priorityLow",
  none: null,
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-accent",
  none: "text-text-tertiary",
};

/**
 * 应用内提醒卡片栈（桌面与移动共用）：系统通知不可用、被拒或被前台抑制时，
 * 到点提醒仍然看得见，并能直接查看任务、标记完成或稍后 10 分钟再提醒。
 */
export function ReminderAlertStack({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const items = useReminderAlertStore((state) => state.items);
  // 没有提醒时不挂载动作 Hook，避免让每个工作区都被迫持有待办查询
  if (items.length === 0) return null;
  return <ReminderAlertCards repoPath={repoPath} items={items} label={t("todo.alertAria")} />;
}

function ReminderAlertCards({ repoPath, items, label }: { repoPath: string | null; items: ReminderAlertItem[]; label: string }) {
  const actions = useReminderAlertActions(repoPath);
  return (
    <aside
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[65] flex flex-col items-center gap-2 px-3"
    >
      {items.map((item) => <ReminderAlertCard key={item.key} item={item} actions={actions} />)}
    </aside>
  );
}

function ReminderAlertCard({ item, actions }: { item: ReminderAlertItem; actions: ReminderAlertActions }) {
  const { t } = useTranslation();
  const priorityKey = PRIORITY_KEYS[item.priority];
  return (
    <section
      role="alert"
      className="pointer-events-auto w-full max-w-md rounded-lg border border-accent/35 bg-bg-primary/95 px-3 py-2.5 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <BellRing size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
            {item.overdue ? (
              <span className="rounded border border-danger/40 px-1 text-danger">{t("todo.groupOverdue")}</span>
            ) : null}
            <span>{t("todo.notifyDue", { due: item.dueLabel })}</span>
            {priorityKey ? <span className={PRIORITY_TONE[item.priority]}>{t(priorityKey)}</span> : null}
          </p>
          {item.detail ? <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{item.detail}</p> : null}
        </div>
        <Tooltip content={t("common.close")}>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => actions.onDismiss(item)}
            className="shrink-0 rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X size={15} />
          </button>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <AlertAction label={t("todo.alertSnooze")} onClick={() => actions.onSnooze(item)} />
        <AlertAction label={t("todo.alertComplete")} onClick={() => actions.onComplete(item)} />
        <AlertAction label={t("todo.alertView")} onClick={() => actions.onView(item)} tone="primary" />
      </div>
    </section>
  );
}

function AlertAction({ label, onClick, tone = "plain" }: { label: string; onClick: () => void; tone?: "plain" | "primary" }) {
  const palette = tone === "primary"
    ? "bg-accent text-bg-primary hover:bg-accent/90"
    : "border border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary";
  return (
    <button type="button" onClick={onClick} className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors sm:min-h-0 sm:py-1 ${palette}`}>
      {label}
    </button>
  );
}
