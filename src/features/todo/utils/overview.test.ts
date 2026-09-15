import { describe, expect, it } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { buildTodoOverview } from "./overview";

function task(overrides: Partial<TaskItemDto>): TaskItemDto {
  return {
    id: "task", listId: "list", title: "Task", description: "", done: false,
    priority: "none", dueDate: null, remindAt: null, sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null, ...overrides,
  };
}

describe("buildTodoOverview", () => {
  const today = new Date(2026, 0, 2);

  it("summarizes progress and date pressure", () => {
    const overview = buildTodoOverview([
      task({ id: "1", title: "Overdue", dueDate: "2026-01-01" }),
      task({ id: "2", title: "Today", dueDate: "2026-01-02" }),
      task({ id: "3", title: "Done", done: true, dueDate: "2026-01-01" }),
    ], today);

    expect(overview).toMatchObject({ total: 3, open: 2, done: 1, overdue: 1, dueToday: 1, progress: 33 });
    expect(overview.focusTasks.map((item) => item.title)).toEqual(["Overdue", "Today"]);
  });

  it("keeps high priority focus and falls back to upcoming work", () => {
    const overview = buildTodoOverview([
      task({ id: "1", title: "Upcoming", dueDate: "2026-01-04" }),
      task({ id: "2", title: "High", priority: "high" }),
      task({ id: "3", title: "Done", done: true }),
    ], today);

    expect(overview.focusTasks.map((item) => item.title)).toEqual(["High"]);
    expect(overview.upcomingTasks.map((item) => item.title)).toEqual(["Upcoming"]);
  });
});
