import type { NoteMeta } from "@/api/types";

export type RecentGroupKey = "today" | "yesterday" | "thisWeek" | "earlier";

export interface RecentNote extends NoteMeta {
  /** 本机最近打开时间（毫秒）；兜底记录使用 updatedAt 换算。 */
  openedAt: number;
}

export interface RecentNoteEntry {
  path: string;
  openedAt: number;
}

export interface RecentNoteGroup {
  key: RecentGroupKey;
  notes: RecentNote[];
}

/** 按最近打开顺序排序，并用笔记列表过滤已不存在/已移动的记录。 */
export function sortRecentNotes(notes: NoteMeta[], recentEntries: readonly RecentNoteEntry[]): RecentNote[] {
  const notesByPath = new Map(notes.map((note) => [note.path, note]));
  const opened = recentEntries
    .map(({ path, openedAt }) => {
      const note = notesByPath.get(path);
      return note ? { ...note, openedAt } : null;
    })
    .filter((note): note is RecentNote => Boolean(note));
  if (opened.length === notes.length) return opened;

  const openedPaths = new Set(opened.map((note) => note.path));
  const byUpdatedAt = [...notes]
    .filter((note) => !openedPaths.has(note.path))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.path.localeCompare(b.path))
    .map((note) => ({ ...note, openedAt: note.updatedAt * 1000 }));
  return [...opened, ...byUpdatedAt];
}

/** 过滤标题和路径；空查询原样返回。 */
export function filterRecentNotes(notes: RecentNote[], query: string): RecentNote[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return notes;
  return notes.filter(
    (note) =>
      note.title.toLocaleLowerCase().includes(needle) ||
      note.path.toLocaleLowerCase().includes(needle),
  );
}

/** 按本机打开时间分组：今天 / 昨天 / 本周 / 更早。 */
export function groupRecentNotes(notes: RecentNote[], now = new Date()): RecentNoteGroup[] {
  const startOfToday = startOfDay(now).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const startOfWeek = startOfToday - (weekday - 1) * 24 * 60 * 60 * 1000;
  const groups: Record<RecentGroupKey, RecentNote[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  for (const note of notes) {
    const key: RecentGroupKey =
      note.openedAt >= startOfToday ? "today"
      : note.openedAt >= startOfYesterday ? "yesterday"
      : note.openedAt >= startOfWeek ? "thisWeek"
      : "earlier";
    groups[key].push(note);
  }

  return Object.entries(groups)
    .map(([key, groupNotes]) => ({ key: key as RecentGroupKey, notes: groupNotes }))
    .filter((group) => group.notes.length > 0);
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
