import { localDateString } from "./task";

export interface MonthCell {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  /** 是否属于当前展示的月份（补位日期为 false） */
  inMonth: boolean;
}

export interface MonthGrid {
  year: number;
  /** 0-11 */
  month: number;
  cells: MonthCell[];
}

/** 固定 6 行 7 列，避免翻月时面板高度跳动 */
export const MONTH_GRID_SIZE = 42;

/** 月份偏移：跨年自动进位，月份始终归一化到 0-11 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** 生成月历网格：周一起始，首尾用相邻月份补满 42 格 */
export function monthGrid(year: number, month: number): MonthGrid {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: MonthCell[] = [];
  for (let index = 0; index < MONTH_GRID_SIZE; index += 1) {
    const day = new Date(year, month, 1 - offset + index);
    cells.push({
      date: localDateString(day),
      day: day.getDate(),
      inMonth: day.getMonth() === month && day.getFullYear() === year,
    });
  }
  return { year, month, cells };
}

/** 由 YYYY-MM-DD 反推年月，用于把面板定位到已选日期所在月份 */
export function monthOf(date: string): { year: number; month: number } {
  const [year, month] = date.split("-").map(Number);
  return { year: year ?? 1970, month: (month ?? 1) - 1 };
}

/** 月份标题，如「2026年9月」/「September 2026」 */
export function monthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(year, month, 1));
}

/** 星期表头（周一起始）；中文去掉「周」前缀只留单字 */
export function weekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-01 是周一，作为表头的固定参照
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)).replace(/^周/, ""));
}
