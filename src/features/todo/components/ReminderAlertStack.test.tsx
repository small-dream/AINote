import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { useReminderAlertStore } from "@/stores/reminderAlert.store";
import { ReminderAlertStack } from "./ReminderAlertStack";
import type { TaskStartupDigest } from "../hooks/useTaskStartupDigest";

const apiMock = vi.hoisted(() => ({ taskBoard: vi.fn(async () => ({ schemaVersion: 3, tasks: [] })) }));
vi.mock("@/api", () => ({ taskApi: { board: apiMock.taskBoard } }));

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "t-1",
    title: "交周报",
    description: "",
    done: false,
    priority: "none",
    dueAt: "2026-09-15",
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function digestOf(onView: () => void, onDismiss: () => void): TaskStartupDigest {
  return {
    digest: {
      overdueCount: 2,
      dueTodayCount: 1,
      items: [task({ id: "old", title: "上周的周报" }), task({ id: "today", title: "今天的复盘", dueAt: "2026-09-16T18:00" })],
      remaining: 1,
      total: 3,
    },
    onView,
    onDismiss,
  };
}

function renderStack({ digest = null }: { digest?: TaskStartupDigest | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReminderAlertStack repoPath="/mock-repo" digest={digest} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useReminderAlertStore.setState({ items: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("提醒浮层里的启动摘要卡", () => {
  it("既没有摘要也没有到点提醒时整层不渲染", () => {
    renderStack();
    expect(screen.queryByLabelText("待办提醒")).toBeNull();
  });

  it("摘要卡排在到点提醒卡片之前，并给出计数与最紧要的几条", () => {
    const now = new Date();
    useReminderAlertStore.getState().push([{
      key: "t-9:2026-09-16T10:00",
      taskId: "t-9",
      title: "交周报",
      dueLabel: "今天 18:00",
      priority: "high",
      detail: null,
      remindAt: now.toISOString(),
      overdue: false,
    }]);

    renderStack({ digest: digestOf(() => undefined, () => undefined) });

    const overlay = screen.getByLabelText("待办提醒");
    const digestCard = within(overlay).getByRole("status");
    expect(digestCard.textContent).toContain("2 项已逾期");
    expect(digestCard.textContent).toContain("1 项今天到期");
    expect(digestCard.textContent).toContain("上周的周报");
    expect(digestCard.textContent).toContain("还有 1 项");

    const cards = Array.from(overlay.children);
    expect(cards[0]?.getAttribute("data-todo-digest")).toBe("");
    expect(cards[1]?.getAttribute("role")).toBe("alert");
  });

  it("「查看待办」与关闭按钮各自回调", () => {
    const onView = vi.fn();
    const onDismiss = vi.fn();
    renderStack({ digest: digestOf(onView, onDismiss) });

    within(screen.getByRole("status")).getByRole("button", { name: "查看待办" }).click();
    expect(onView).toHaveBeenCalledTimes(1);

    within(screen.getByRole("status")).getByRole("button", { name: "今天不再提醒" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
