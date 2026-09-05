import { describe, expect, it } from "vitest";
import type { NoteMeta } from "@/api/types";
import { filterRecentNotes, groupRecentNotes, sortRecentNotes } from "./recent";

const DAY = 24 * 60 * 60;
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0) / 1000;
const SECONDS_BY_PATH: Record<string, number> = {
  "old.md": 8 * DAY,
  "today.md": 60,
  "week.md": 2 * DAY,
  "yesterday.md": 1 * DAY,
};

function note(path: string, title: string, secondsAgo: number): NoteMeta {
  return { path, kind: "markdown", title, updatedAt: NOW - secondsAgo };
}

const baseNotes: NoteMeta[] = [
  note("old.md", "Old", 8 * DAY),
  note("today.md", "Today", 60),
  note("week.md", "Week", 2 * DAY),
  note("yesterday.md", "Yesterday", 1 * DAY),
];
const notes = baseNotes.map((note) => ({
  ...note,
  openedAt: NOW * 1000 - (SECONDS_BY_PATH[note.path] ?? 0) * 1000,
}));
const recentEntries = [
  { path: "week.md", openedAt: (NOW - 60) * 1000 },
  { path: "today.md", openedAt: (NOW - 120) * 1000 },
  { path: "missing.md", openedAt: (NOW - 120) * 1000 },
];

describe("sortRecentNotes", () => {
  it("优先保持打开顺序并过滤失效记录", () => {
    expect(sortRecentNotes(baseNotes, recentEntries).map((note) => note.path))
      .toEqual(["week.md", "today.md", "yesterday.md", "old.md"]);
  });
});

describe("filterRecentNotes", () => {
  it("匹配标题和路径", () => {
    expect(filterRecentNotes(notes, "TODAY").map((note) => note.path)).toEqual(["today.md"]);
  });
});

describe("groupRecentNotes", () => {
  it("按打开时间分为今天、昨天、本周和更早", () => {
    const groups = groupRecentNotes(notes, new Date(NOW * 1000));
    expect(groups.map((group) => group.key)).toEqual(["today", "yesterday", "thisWeek", "earlier"]);
  });
});
