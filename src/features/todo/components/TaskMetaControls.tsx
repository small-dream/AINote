import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, Calendar, CalendarCheck, CalendarPlus, CalendarRange, CalendarX, Check, Flag, Sunrise, type LucideIcon } from "lucide-react";
import type { TaskPriority } from "@/api/types";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { addLocalDays, dueDayOffset, localDateString } from "../utils/task";

export const PRIORITY_FLAG_CLASS: Record<Exclude<TaskPriority, "none">, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-accent",
};

const PRIORITY_LABEL_KEY: Record<TaskPriority, TranslationKey> = {
  high: "todo.priorityHigh",
  medium: "todo.priorityMedium",
  low: "todo.priorityLow",
  none: "todo.priorityNone",
};

const MENU_CLASS = "fixed z-50 w-52 rounded-xl border border-border bg-bg-primary p-1 shadow-xl";

interface ChipProps {
  icon: LucideIcon;
  label: string;
  menuLabel: string;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  toneClass?: string | undefined;
  children: (close: () => void) => ReactNode;
}

/** 元数据 chip 按钮 + portal 弹层：mousedown 阻止默认行为，避免抢走输入框焦点。 */
function Chip({ icon: Icon, label, menuLabel, tooltip, active = false, disabled = false, toneClass, children }: ChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { menuRef, position } = useAnchoredLayer({ triggerRef, open, close: () => setOpen(false), width: 208, align: "start" });
  const close = () => setOpen(false);

  return (
    <div ref={triggerRef} className="relative shrink-0">
      <Tooltip content={tooltip}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={menuLabel}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
          className={`flex h-9 max-w-40 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors disabled:opacity-40 sm:h-6 sm:max-w-32 sm:rounded-md sm:px-1.5 sm:text-[11px] ${
            active
              ? `border-transparent bg-bg-tertiary ${toneClass ?? "text-text-primary"}`
              : "border-transparent text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
          }`}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </Tooltip>
      {open ? createPortal(
        <div ref={menuRef} role="menu" aria-label={menuLabel} style={position} className={MENU_CLASS}>
          {children(close)}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  iconClass?: string | undefined;
  onSelect: () => void;
}

function MenuItem({ icon: Icon, label, active = false, iconClass, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${active ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" className={`shrink-0 ${iconClass ?? "text-text-tertiary"}`} />
      <span className="flex-1 truncate">{label}</span>
      {active ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
    </button>
  );
}

/** 截止日期展示文案：今天 / 明天 / MM-DD */
export function dueDateLabel(dueDate: string, todayLabel: string, tomorrowLabel: string): string {
  const offset = dueDayOffset(dueDate, new Date());
  if (offset === 0) return todayLabel;
  if (offset === 1) return tomorrowLabel;
  return dueDate.slice(5);
}

interface DueDateChipProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/** 截止日期 chip：快捷选项（今天/明天/后天/下周）+ 自定义日期 + 清除。 */
export function DueDateChip({ value, onChange }: DueDateChipProps) {
  const { t } = useTranslation();
  const offset = value ? dueDayOffset(value, new Date()) : null;
  const toneClass = offset !== null && offset < 0 ? "text-danger" : offset === 0 ? "text-accent" : undefined;
  const today = new Date();
  const shortcuts: { key: TranslationKey; icon: LucideIcon; date: string }[] = [
    { key: "todo.dateToday", icon: CalendarCheck, date: localDateString(today) },
    { key: "todo.dateTomorrow", icon: Sunrise, date: localDateString(addLocalDays(today, 1)) },
    { key: "todo.dateDayAfter", icon: CalendarPlus, date: localDateString(addLocalDays(today, 2)) },
    { key: "todo.dateNextWeek", icon: CalendarRange, date: localDateString(addLocalDays(today, ((8 - today.getDay()) % 7) || 7)) },
  ];

  return (
    <Chip
      icon={Calendar}
      label={value ? dueDateLabel(value, t("todo.dateToday"), t("todo.dateTomorrow")) : t("todo.dueDate")}
      menuLabel={t("todo.setDueDate")}
      tooltip={t("todo.setDueDate")}
      active={value !== null}
      toneClass={toneClass}
    >
      {(close) => (
        <>
          {shortcuts.map((shortcut) => (
            <MenuItem
              key={shortcut.key}
              icon={shortcut.icon}
              label={t(shortcut.key)}
              active={value === shortcut.date}
              onSelect={() => { onChange(shortcut.date); close(); }}
            />
          ))}
          <div className="mx-1 my-1 border-t border-border" />
          <input
            type="date"
            aria-label={t("todo.pickDate")}
            value={value ?? ""}
            onChange={(event) => { onChange(event.target.value || null); close(); }}
            className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
          />
          {value !== null ? (
            <MenuItem icon={CalendarX} label={t("todo.dateClear")} onSelect={() => { onChange(null); close(); }} />
          ) : null}
        </>
      )}
    </Chip>
  );
}

interface PriorityChipProps {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
}

/** 优先级 chip：无/低/中/高四级，旗帜颜色与任务行一致。 */
export function PriorityChip({ value, onChange }: PriorityChipProps) {
  const { t } = useTranslation();
  const flagClass = value === "none" ? undefined : PRIORITY_FLAG_CLASS[value];
  return (
    <Chip
      icon={Flag}
      label={value === "none" ? t("todo.priority") : t(PRIORITY_LABEL_KEY[value])}
      menuLabel={t("todo.setPriority")}
      tooltip={t("todo.setPriority")}
      active={value !== "none"}
      toneClass={flagClass}
    >
      {(close) => (
        <>
          {(["high", "medium", "low", "none"] as TaskPriority[]).map((option) => (
            <MenuItem
              key={option}
              icon={Flag}
              label={t(PRIORITY_LABEL_KEY[option])}
              active={value === option}
              iconClass={option === "none" ? undefined : PRIORITY_FLAG_CLASS[option]}
              onSelect={() => { onChange(option); close(); }}
            />
          ))}
        </>
      )}
    </Chip>
  );
}

interface ReminderChipProps {
  dueDate: string | null;
  /** input[type=datetime-local] 的本地值；空串表示未开启 */
  value: string;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}

/** 提醒 chip：点击开启（默认截止日 09:00），已开启时可改时间或关闭。 */
export function ReminderChip({ dueDate, value, onToggle, onChange }: ReminderChipProps) {
  const { t } = useTranslation();
  const enabled = value !== "";
  return (
    <Chip
      icon={Bell}
      label={enabled ? value.slice(11) : t("todo.reminder")}
      menuLabel={t("todo.setReminder")}
      tooltip={dueDate ? t("todo.setReminder") : t("todo.reminderNeedsDue")}
      active={enabled}
      disabled={!dueDate && !enabled}
    >
      {(close) => (
        <>
          <input
            type="datetime-local"
            aria-label={t("todo.setReminder")}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
          />
          <MenuItem icon={BellOff} label={t("todo.reminderOff")} onSelect={() => { onToggle(false); close(); }} />
        </>
      )}
    </Chip>
  );
}
