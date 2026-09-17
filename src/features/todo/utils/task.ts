import type { TaskItemDto, TaskPriority } from "@/api/types";

export type TaskGroup = "overdue" | "today" | "upcoming" | "none" | "done";

export interface TaskGroupSection {
  group: TaskGroup;
  tasks: TaskItemDto[];
}

export const TASK_GROUP_ORDER: TaskGroup[] = ["overdue", "today", "upcoming", "none", "done"];

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** 本地日期的 YYYY-MM-DD（与截止时间的日期部分同口径比较） */
export function localDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 本地日期加 N 天（不受夏令时影响） */
export function addLocalDays(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** 截止时间的日期部分（YYYY-MM-DD），忽略具体时刻 */
export function dueDay(dueAt: string): string {
  return dueAt.slice(0, 10);
}

/** 截止时间的具体时刻（HH:mm）；只到天时返回空串 */
export function dueTime(dueAt: string): string {
  return dueAt.includes("T") ? dueAt.slice(11, 16) : "";
}

/** 创建时间的本地展示文案：`M/D HH:mm`（按当前 locale 格式化）；无法解析时回退空串。 */
export function createdAtLabel(createdAt: string, locale: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** 组装截止时间：没有时刻时只保留日期，语义为「当天结束前」 */
export function buildDueAt(date: string, time: string): string {
  return time ? `${date}T${time}` : date;
}

/** 截止时刻：只到天时取当天 23:59，到分钟时取该本地时刻 */
export function dueInstant(dueAt: string): Date {
  const [date, time] = dueAt.split("T");
  const [year, month, day] = (date ?? "").split("-").map(Number);
  const [hour, minute] = time ? time.split(":").map(Number) : [23, 59];
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, time ? 0 : 59);
}

/** 截止日期相对今天的偏移天数：0 今天、1 明天、负数已逾期（只看日期，不看时刻） */
export function dueDayOffset(dueAt: string, today: Date): number {
  const [year, month, day] = dueDay(dueAt).split("-").map(Number);
  const due = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - base.getTime()) / 86400000);
}

/**
 * 截止日期展示文案：今天 / 明天 / MM-DD（今天与明天的文案由调用方按语言传入）。
 * `now` 与 `dueDayOffset` 同源由调用方注入：提醒通知里两者必须用同一个时刻，
 * 否则跨过午夜（或测试注入固定时刻）时「相对文案」与「偏移天数」会互相打架。
 */
export function dueDateLabel(
  dueAt: string,
  todayLabel: string,
  tomorrowLabel: string,
  now: Date
): string {
  const offset = dueDayOffset(dueAt, now);
  if (offset === 0) return todayLabel;
  if (offset === 1) return tomorrowLabel;
  return dueDay(dueAt).slice(5);
}

function groupOf(task: TaskItemDto, now: Date): TaskGroup {
  if (task.done) return "done";
  if (!task.dueAt) return "none";
  const today = localDateString(now);
  const day = dueDay(task.dueAt);
  if (day < today) return "overdue";
  if (day > today) return "upcoming";
  // 当天的任务按具体时刻判逾期：今天 18:00 在 18:00 之后落到「已逾期」
  return dueInstant(task.dueAt) < now ? "overdue" : "today";
}

/** 与后端 due_sort_key 等价：只到天的截止视为当天最后 */
function dueSortKey(dueAt: string): string {
  return dueAt.includes("T") ? dueAt : `${dueAt}T99:99`;
}

/** 组内排序：dueAt 升序 → 优先级 high>medium>low>none → createdAt 升序 */
export function compareTasks(a: TaskItemDto, b: TaskItemDto): number {
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    const keyA = dueSortKey(a.dueAt);
    const keyB = dueSortKey(b.dueAt);
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
  }
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** 把任务按逾期/今天/未来/无日期/已完成分组并排序；空组也保留（由 UI 决定是否隐藏）。 */
export function groupTasks(tasks: TaskItemDto[], now: Date): TaskGroupSection[] {
  const sections: TaskGroupSection[] = TASK_GROUP_ORDER.map((group) => ({ group, tasks: [] }));
  for (const task of tasks) {
    sections[TASK_GROUP_ORDER.indexOf(groupOf(task, now))]?.tasks.push(task);
  }
  for (const section of sections) section.tasks.sort(compareTasks);
  return sections;
}

/** RFC3339 → input[type=datetime-local] 的本地值；空值回退空串。 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${localDateString(date)}T${hh}:${mm}`;
}

/** input[type=datetime-local] 的本地值 → RFC3339；空串回退 null。 */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface ReminderPlan {
  /** 未完成且 remindAt 在未来：需要调度 */
  schedule: TaskItemDto[];
  /** 未完成且 remindAt 已过：需要补发 */
  overdue: TaskItemDto[];
}

/** 提醒对账：按当前时间把带提醒的未完成任务分为「待调度」与「已到期」两组。 */
export function reconcileReminders(tasks: TaskItemDto[], now: Date): ReminderPlan {
  const plan: ReminderPlan = { schedule: [], overdue: [] };
  for (const task of tasks) {
    if (task.done || !task.remindAt) continue;
    const at = new Date(task.remindAt);
    if (Number.isNaN(at.getTime())) continue;
    (at.getTime() > now.getTime() ? plan.schedule : plan.overdue).push(task);
  }
  return plan;
}

export interface ParsedTaskInput {
  title: string;
  dueAt: string | null;
  priority: TaskPriority;
}

const ZH_WEEKDAY: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const EN_WEEKDAY: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

/** 目标星期几的日期：nextWeek 取下周（以下周一为基准偏移），否则取未来最近的一次（当天顺延到下周） */
function weekdayDate(today: Date, target: number, nextWeek: boolean): Date {
  if (nextWeek) {
    const daysToNextMonday = (8 - today.getDay()) % 7 || 7;
    return addLocalDays(today, daysToNextMonday + ((target - 1 + 7) % 7));
  }
  const delta = (target - today.getDay() + 7) % 7;
  return addLocalDays(today, delta === 0 ? 7 : delta);
}

/** 构造「月-日」日期；今年已过去则滚动到明年；非法日期返回 null */
function rollingMonthDay(today: Date, month: number, day: number): Date | null {
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  if (thisYear.getMonth() !== month - 1 || thisYear.getDate() !== day) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return thisYear < startOfToday ? new Date(today.getFullYear() + 1, month - 1, day) : thisYear;
}

interface DateRule {
  pattern: RegExp;
  resolve: (match: RegExpMatchArray, today: Date) => Date | null;
}

const DATE_RULES: DateRule[] = [
  { pattern: /大后天/, resolve: (_m, t) => addLocalDays(t, 3) },
  { pattern: /后天|\bday after tomorrow\b/i, resolve: (_m, t) => addLocalDays(t, 2) },
  { pattern: /明天|明日|\btomorrow\b/i, resolve: (_m, t) => addLocalDays(t, 1) },
  { pattern: /今天|今日|\btoday\b/i, resolve: (_m, t) => t },
  { pattern: /下(?:个)?(?:周|星期)([一二三四五六日天])/, resolve: (m, t) => weekdayDate(t, ZH_WEEKDAY[m[1] ?? "一"] ?? 1, true) },
  { pattern: /(?:周|星期)([一二三四五六日天])/, resolve: (m, t) => weekdayDate(t, ZH_WEEKDAY[m[1] ?? "一"] ?? 1, false) },
  { pattern: /\bnext (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, resolve: (m, t) => weekdayDate(t, EN_WEEKDAY[(m[1] ?? "").toLowerCase()] ?? 1, true) },
  { pattern: /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, resolve: (m, t) => weekdayDate(t, EN_WEEKDAY[(m[1] ?? "").toLowerCase()] ?? 1, false) },
  { pattern: /下周|下个星期|\bnext week\b/i, resolve: (_m, t) => weekdayDate(t, 1, true) },
  { pattern: /月底|月末/, resolve: (_m, t) => new Date(t.getFullYear(), t.getMonth() + 1, 0) },
  {
    pattern: /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?/,
    resolve: (m) => {
      const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return date.getMonth() === Number(m[2]) - 1 && date.getDate() === Number(m[3]) ? date : null;
    },
  },
  { pattern: /(\d{1,2})月(\d{1,2})[日号]/, resolve: (m, t) => rollingMonthDay(t, Number(m[1]), Number(m[2])) },
  { pattern: /\b(\d{1,2})[/-](\d{1,2})\b/, resolve: (m, t) => rollingMonthDay(t, Number(m[1]), Number(m[2])) },
];

const PRIORITY_PATTERN = /(?:^|\s)p([1-3])(?=\s|$)|[!！]([高中低])/i;

function priorityOf(match: RegExpMatchArray): TaskPriority {
  const digit = match[1];
  if (digit === "1") return "high";
  if (digit === "2") return "medium";
  if (digit === "3") return "low";
  const word = match[2];
  if (word === "高") return "high";
  if (word === "中") return "medium";
  return "low";
}

interface TimeToken {
  hour: number;
  minute: number;
}

const TIME_RULES: { pattern: RegExp; read: (match: RegExpMatchArray) => TimeToken | null }[] = [
  { pattern: /(?:^|\s)(\d{1,2})[:：](\d{2})(?=\s|$)/, read: (m) => timeToken(Number(m[1]), Number(m[2])) },
  { pattern: /(?:^|\s)(\d{1,2})\s*[点时](?:(\d{1,2})\s*分?)?(?=\s|$)/, read: (m) => timeToken(Number(m[1]), m[2] ? Number(m[2]) : 0) },
];

function timeToken(hour: number, minute: number): TimeToken | null {
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

function clockLabel(token: TimeToken): string {
  return `${String(token.hour).padStart(2, "0")}:${String(token.minute).padStart(2, "0")}`;
}

/** 从标题中摘出日期（首个命中的日期规则生效） */
function extractDate(text: string, today: Date): { rest: string; value: string | null } {
  const rest = text;
  for (const rule of DATE_RULES) {
    const match = rest.match(rule.pattern);
    if (!match) continue;
    const resolved = rule.resolve(match, today);
    if (!resolved) continue;
    return { rest: rest.replace(rule.pattern, " "), value: localDateString(resolved) };
  }
  return { rest, value: null };
}

/** 从标题中摘出时刻（首个命中的时间规则生效） */
function extractTime(text: string): { rest: string; token: TimeToken | null } {
  for (const rule of TIME_RULES) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    const token = rule.read(match);
    if (!token) continue;
    return { rest: text.replace(rule.pattern, " "), token };
  }
  return { rest: text, token: null };
}

/** 只有时刻没有日期时按今天算；该时刻已过则顺延到明天 */
function joinDueAt(date: string | null, token: TimeToken | null, now: Date): string | null {
  if (!date) {
    if (!token) return null;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), token.hour, token.minute);
    const day = at < now ? addLocalDays(now, 1) : now;
    return `${localDateString(day)}T${clockLabel(token)}`;
  }
  return token ? `${date}T${clockLabel(token)}` : date;
}

/** 快速添加的自然语言识别：从标题中摘出截止时间（日期 + 可选时刻）与优先级。 */
export function parseTaskInput(raw: string, now: Date): ParsedTaskInput {
  const date = extractDate(raw, now);
  const time = extractTime(date.rest);
  let text = time.rest;
  let priority: TaskPriority = "none";
  const priorityMatch = text.match(PRIORITY_PATTERN);
  if (priorityMatch) {
    priority = priorityOf(priorityMatch);
    text = text.replace(PRIORITY_PATTERN, " ");
  }
  const title = text.replace(/\s+/g, " ").trim();
  return { title: title || raw.trim(), dueAt: joinDueAt(date.value, time.token, now), priority };
}
