import { useTranslation } from "@/i18n";
import { REMINDER_PRESETS, remindAtForPreset, remindAtOnDueDay, reminderClock, reminderPresetOf } from "../utils/reminder";
import { TimePicker } from "./TimePicker";

interface ReminderPanelProps {
  /** 截止时间；提醒必须依附于它 */
  dueAt: string;
  /** 当前提醒（RFC3339）；null 表示未开启 */
  value: string | null;
  onChange: (value: string | null) => void;
  onDone: () => void;
}

/**
 * 提醒面板：左侧是相对截止时间的提前量预设（准时 / 5 分钟前 … 1 天前），
 * 下方可把提醒精调到「截止日当天」的任意钟点。选择即生效，无需二次确认。
 */
export function ReminderPanel({ dueAt, value, onChange, onDone }: ReminderPanelProps) {
  const { t } = useTranslation();
  const preset = value ? reminderPresetOf(dueAt, value) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 视口过矮时面板会限高，内容区滚动保证「提前量」与滚轮都能操作到 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1">
        <div className="flex flex-wrap items-center gap-0.5">
          <OptionChip label={t("todo.reminderOff")} active={value === null} onSelect={() => onChange(null)} />
          {REMINDER_PRESETS.map((item) => (
            <OptionChip
              key={item.minutes}
              label={t(item.labelKey, { count: item.count ?? 0 })}
              active={preset?.minutes === item.minutes}
              onSelect={() => onChange(remindAtForPreset(dueAt, item.minutes))}
            />
          ))}
        </div>
        <p className="mt-2 mb-1 px-1 text-[11px] font-medium text-text-tertiary">{t("todo.reminderSameDay")}</p>
        <TimePicker
          value={value ? reminderClock(value) : ""}
          onChange={(next) => onChange(remindAtOnDueDay(dueAt, next))}
          onClear={() => onChange(null)}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function OptionChip({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors sm:px-1.5 sm:py-0.5 sm:text-[11px] ${
        active ? "bg-accent/10 font-medium text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
