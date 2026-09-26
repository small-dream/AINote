import { BellRing, CalendarClock, X } from "lucide-react";
import type { TaskPriority } from "@/api/types";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useReminderAlertStore, type ReminderAlertItem } from "@/stores/reminderAlert.store";
import type { TaskStartupDigest } from "../hooks/useTaskStartupDigest";
import { useReminderAlertActions, type ReminderAlertActions } from "../hooks/useReminderAlertActions";
import { reminderDueLabel } from "../utils/reminderMessage";
import type { StartupDigest } from "../utils/startupDigest";

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

const CARD_CLASS = "pointer-events-auto w-full max-w-md rounded-lg border border-accent/35 bg-bg-primary/95 px-3 py-2.5 shadow-lg backdrop-blur";

/**
 * 待办顶部提醒浮层（桌面与移动共用）：启动摘要卡在前、到点提醒卡片在后。
 * 两者的定位一致——系统通知不可用、被拒或被前台抑制时，打开应用仍然看得见，
 * 且能直接查看任务或标记完成。
 */
export function ReminderAlertStack({ repoPath, digest = null }: { repoPath: string | null; digest?: TaskStartupDigest | null }) {
  const { t } = useTranslation();
  const items = useReminderAlertStore((state) => state.items);
  // 没有摘要也没有提醒时不挂载动作 Hook，避免让每个工作区都被迫持有待办查询
  if (items.length === 0 && !digest) return null;
  return <TodoAlertCards repoPath={repoPath} items={items} digest={digest} label={t("todo.alertAria")} />;
}

function TodoAlertCards({ repoPath, items, digest, label }: { repoPath: string | null; items: ReminderAlertItem[]; digest: TaskStartupDigest | null; label: string }) {
  const actions = useReminderAlertActions(repoPath);
  return (
    <aside
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[65] flex flex-col items-center gap-2 px-3"
    >
      {digest ? <DigestCard digest={digest.digest} onView={digest.onView} onDismiss={digest.onDismiss} /> : null}
      {items.map((item) => <ReminderAlertCard key={item.key} item={item} actions={actions} />)}
    </aside>
  );
}

/** 启动摘要卡：计数 + 最紧要的几条 + 「查看待办」，不依赖系统通知权限 */
function DigestCard({ digest, onView, onDismiss }: { digest: StartupDigest; onView: () => void; onDismiss: () => void }) {
  const { locale, t } = useTranslation();
  const now = new Date();
  const dismissLabel = t("todo.digestDismiss");
  return (
    <section role="status" data-todo-digest="" aria-label={t("todo.digestTitle")} className={CARD_CLASS}>
      <div className="flex items-start gap-2">
        <CalendarClock size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{t("todo.digestTitle")}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
            {digest.overdueCount > 0 ? (
              <span className="rounded border border-danger/40 px-1 text-danger">{t("todo.digestOverdue", { count: digest.overdueCount })}</span>
            ) : null}
            {digest.dueTodayCount > 0 ? (
              <span className="text-warning">{t("todo.digestDueToday", { count: digest.dueTodayCount })}</span>
            ) : null}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-text-secondary">
            {digest.items.map((task) => (
              <li key={task.id} className="truncate">
                {t("todo.notifyLine", { title: task.title, due: reminderDueLabel(task, locale, now) ?? "" })}
              </li>
            ))}
          </ul>
          {digest.remaining > 0 ? <p className="mt-1 text-xs text-text-tertiary">{t("todo.digestMore", { count: digest.remaining })}</p> : null}
        </div>
        <Tooltip content={dismissLabel}>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className="shrink-0 rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X size={15} />
          </button>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <AlertAction label={t("todo.digestView")} onClick={onView} tone="primary" />
      </div>
    </section>
  );
}

function ReminderAlertCard({ item, actions }: { item: ReminderAlertItem; actions: ReminderAlertActions }) {
  const { t } = useTranslation();
  const priorityKey = PRIORITY_KEYS[item.priority];
  return (
    <section role="alert" className={CARD_CLASS}>
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
