import { Bell, BellOff, Calendar, Clock, Flag } from "lucide-react";
import type { TaskPriority } from "@/api/types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { usesNativeDateTimeInput } from "@/platform/native-datetime";
import { buildDueAt, dueDateLabel, dueDay, dueDayOffset, dueTime } from "../utils/task";
import { reminderClock, reminderPresetOf } from "../utils/reminder";
import { Chip, MenuItem } from "./ChipShell";
import { DueDatePanel } from "./DueDatePanel";
import { NativeDueDateChip, NativeDueTimeChip } from "./NativeDueChips";
import { ReminderPanel } from "./ReminderPanel";
import { TimePicker } from "./TimePicker";

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

interface DueDateChipProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/** 截止日期 chip：移动壳交给系统日期选择器，桌面壳用自研月历面板。 */
export function DueDateChip({ value, onChange }: DueDateChipProps) {
  if (usesNativeDateTimeInput("date")) return <NativeDueDateChip value={value} onChange={onChange} />;
  return <DesktopDueDateChip value={value} onChange={onChange} />;
}

/** 桌面截止日期 chip：只选到哪天。具体时刻由旁边的「时间」chip 单独设置。 */
function DesktopDueDateChip({ value, onChange }: DueDateChipProps) {
  const { t } = useTranslation();
  const offset = value ? dueDayOffset(value, new Date()) : null;
  const toneClass = offset !== null && offset < 0 ? "text-danger" : offset === 0 ? "text-accent" : undefined;

  return (
    <Chip
      icon={Calendar}
      label={value ? dueDateLabel(value, t("todo.dateToday"), t("todo.dateTomorrow")) : t("todo.dueDate")}
      menuLabel={t("todo.setDueDate")}
      tooltip={t("todo.setDueDate")}
      active={value !== null}
      toneClass={toneClass}
      menuWidth={300}
    >
      {(close) => <DueDatePanel value={value} onChange={onChange} onDone={close} />}
    </Chip>
  );
}

interface DueTimeChipProps {
  /** 当前截止时间；null 表示还没选日期 */
  dueAt: string | null;
  onChange: (value: string | null) => void;
}

/** 时间 chip：在已选日期上追加一天中的具体时刻，留空即「当天结束前」。 */
export function DueTimeChip({ dueAt, onChange }: DueTimeChipProps) {
  if (usesNativeDateTimeInput("time")) return <NativeDueTimeChip dueAt={dueAt} onChange={onChange} />;
  return <DesktopDueTimeChip dueAt={dueAt} onChange={onChange} />;
}

/** 桌面时间 chip：在已选日期上追加一天中的具体时刻，留空即「当天结束前」。 */
function DesktopDueTimeChip({ dueAt, onChange }: DueTimeChipProps) {
  const { t } = useTranslation();
  const time = dueAt ? dueTime(dueAt) : "";
  const disabled = dueAt === null;

  return (
    <Chip
      icon={Clock}
      label={time || t("todo.dueTime")}
      menuLabel={t("todo.setDueTime")}
      tooltip={disabled ? t("todo.timeNeedsDate") : t("todo.setDueTime")}
      active={time !== ""}
      disabled={disabled}
      menuWidth={264}
    >
      {(close) => (
        <TimePicker
          value={time}
          onChange={(next) => onChange(buildDueAt(dueDay(dueAt ?? ""), next))}
          onClear={() => onChange(dueDay(dueAt ?? ""))}
          onDone={close}
        />
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
  dueAt: string | null;
  /** 提醒时刻（RFC3339）；null 表示未开启 */
  value: string | null;
  onChange: (value: string | null) => void;
}

/** 提醒 chip：以相对截止时间的提前量为主（准时 / 5 分钟前 … 1 天前），当天钟点可精调。 */
export function ReminderChip({ dueAt, value, onChange }: ReminderChipProps) {
  const { t } = useTranslation();
  const disabled = dueAt === null;
  const preset = dueAt && value ? reminderPresetOf(dueAt, value) : null;
  const label = value === null
    ? t("todo.reminder")
    : preset
      ? t(preset.labelKey, { count: preset.count ?? 0 })
      : reminderClock(value);

  return (
    <Chip
      icon={Bell}
      label={label}
      menuLabel={t("todo.setReminder")}
      tooltip={disabled ? t("todo.reminderNeedsDue") : t("todo.setReminder")}
      active={value !== null}
      disabled={disabled}
      menuWidth={280}
    >
      {(close) => dueAt ? (
        <ReminderPanel dueAt={dueAt} value={value} onChange={onChange} onDone={close} />
      ) : (
        <MenuItem icon={BellOff} label={t("todo.reminderNeedsDue")} onSelect={close} />
      )}
    </Chip>
  );
}
