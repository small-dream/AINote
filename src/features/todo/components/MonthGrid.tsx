import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { monthGrid, monthLabel, weekdayLabels, type MonthCell } from "../utils/calendar";

interface MonthGridProps {
  year: number;
  /** 0-11 */
  month: number;
  /** 已选日期（YYYY-MM-DD） */
  selected: string | null;
  /** 今天（YYYY-MM-DD） */
  today: string;
  onShift: (delta: number) => void;
  onSelect: (date: string) => void;
}

/** 月历：周一起始、固定 6 行，今日描边高亮、选中填充强调色。 */
export function MonthGrid({ year, month, selected, today, onShift, onSelect }: MonthGridProps) {
  const { locale, t } = useTranslation();
  const grid = monthGrid(year, month);

  return (
    <div>
      <MonthNavigator
        label={monthLabel(year, month, locale)}
        onPrev={() => onShift(-1)}
        onNext={() => onShift(1)}
        prevLabel={t("todo.prevMonth")}
        nextLabel={t("todo.nextMonth")}
      />
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {weekdayLabels(locale).map((label) => (
          <span key={label} className="py-1 text-[10px] font-medium text-text-tertiary">{label}</span>
        ))}
        {grid.cells.map((cell) => (
          <DayCell key={cell.date} cell={cell} selected={selected} today={today} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface MonthNavigatorProps {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

function MonthNavigator({ label, prevLabel, nextLabel, onPrev, onNext }: MonthNavigatorProps) {
  const buttonClass = "grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary";
  return (
    <div className="mb-0.5 flex items-center justify-between px-1">
      <button type="button" aria-label={prevLabel} onClick={onPrev} className={buttonClass}>
        <ChevronLeft size={13} aria-hidden="true" />
      </button>
      <span className="text-xs font-medium text-text-primary">{label}</span>
      <button type="button" aria-label={nextLabel} onClick={onNext} className={buttonClass}>
        <ChevronRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

interface DayCellProps {
  cell: MonthCell;
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
}

function DayCell({ cell, selected, today, onSelect }: DayCellProps) {
  const isSelected = cell.date === selected;
  const isToday = cell.date === today;
  const tone = isSelected
    ? "bg-accent font-medium text-white"
    : isToday
      ? "font-semibold text-accent hover:bg-accent/10"
      : `${cell.inMonth ? "text-text-primary" : "text-text-tertiary"} hover:bg-bg-tertiary`;

  return (
    <button
      type="button"
      aria-label={cell.date}
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      onClick={() => onSelect(cell.date)}
      className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-xs transition-colors sm:h-7 sm:w-7 sm:text-[11px] ${tone}`}
    >
      {cell.day}
    </button>
  );
}
