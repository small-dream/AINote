/** 本地日期的 YYYY-MM-DD（独立实现，避免与 task.ts 互相引用形成环） */
function toLocalDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 日期短标签：与 `now` 同年返回 MM-DD，跨年返回 YYYY-MM-DD。
 * 输入为 YYYY-MM-DD 或带时刻的 YYYY-MM-DDTHH:mm，只取日期部分判断。
 */
export function shortDayLabel(value: string, now: Date): string {
  const day = value.slice(0, 10);
  return day.slice(0, 4) === String(now.getFullYear()) ? day.slice(5) : day;
}

/** RFC3339 创建时间的本地日期短标签；非法时间返回 null。 */
export function createdDayLabel(createdAt: string, now: Date): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return shortDayLabel(toLocalDay(date), now);
}
