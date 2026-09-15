import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { monthOf, shiftMonth } from "../utils/calendar";
import { addLocalDays, buildDueAt, dueDay, dueTime, localDateString } from "../utils/task";
import { MonthGrid } from "./MonthGrid";

interface DueDatePanelProps {
  /** 当前截止时间：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm */
  value: string | null;
  onChange: (value: string | null) => void;
  onDone: () => void;
}

/** 截止日期面板：快捷日期 + 月历选日；具体时刻由旁边的「时间」控件单独设置。 */
export function DueDatePanel({ value, onChange, onDone }: DueDatePanelProps) {
  const { t } = useTranslation();
  const today = localDateString(new Date());
  const selected = value ? dueDay(value) : null;
  const time = value ? dueTime(value) : "";
  const [cursor, setCursor] = useState(() => monthOf(selected ?? today));

  function selectDate(date: string): void {
    onChange(buildDueAt(date, time));
    setCursor(monthOf(date));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 高度受限时只有内容区滚动，底部操作栏始终可见 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuickDateRow today={today} selected={selected} onSelect={selectDate} />
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          selected={selected}
          today={today}
          onShift={(delta) => setCursor((current) => shiftMonth(current.year, current.month, delta))}
          onSelect={selectDate}
        />
      </div>
      <div className="mt-2 flex shrink-0 items-center gap-2 border-t border-border/70 px-1 pt-2">
        <button
          type="button"
          disabled={value === null}
          onClick={() => { onChange(null); onDone(); }}
          className="rounded-md px-1 py-1.5 text-xs text-text-tertiary transition-colors hover:text-danger disabled:opacity-40 sm:px-0 sm:py-0 sm:text-[11px]"
        >
          {t("todo.dateClear")}
        </button>
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={onDone} className="!px-3 !py-1.5 !text-xs sm:!px-2 sm:!py-0.5 sm:!text-[11px]">
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}

interface QuickDateRowProps {
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
}

/** 快捷日期行：覆盖「今天 / 明天 / 后天 / 下周」四类高频选择 */
function QuickDateRow({ today, selected, onSelect }: QuickDateRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1 px-1 pb-2">
      {dateShortcuts(today).map((shortcut) => (
        <button
          key={shortcut.labelKey}
          type="button"
          aria-pressed={selected === shortcut.date}
          onClick={() => onSelect(shortcut.date)}
          className={`rounded-md px-2.5 py-1.5 text-xs transition-colors sm:px-1.5 sm:py-0.5 sm:text-[11px] ${
            selected === shortcut.date
              ? "bg-accent/10 font-medium text-accent"
              : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          {t(shortcut.labelKey)}
        </button>
      ))}
    </div>
  );
}

function dateShortcuts(today: string): { labelKey: "todo.dateToday" | "todo.dateTomorrow" | "todo.dateDayAfter" | "todo.dateNextWeek"; date: string }[] {
  const base = new Date(`${today}T00:00:00`);
  return [
    { labelKey: "todo.dateToday", date: today },
    { labelKey: "todo.dateTomorrow", date: localDateString(addLocalDays(base, 1)) },
    { labelKey: "todo.dateDayAfter", date: localDateString(addLocalDays(base, 2)) },
    { labelKey: "todo.dateNextWeek", date: localDateString(addLocalDays(base, ((8 - base.getDay()) % 7) || 7)) },
  ];
}
