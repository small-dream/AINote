import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { useUiStore } from "@/stores/ui.store";
import { TodoWorkspace } from "./TodoWorkspace";

const apiMock = vi.hoisted(() => ({
  taskBoard: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskToggle: vi.fn(),
  taskRemove: vi.fn(),
}));
vi.mock("@/api", () => ({
  taskApi: {
    board: apiMock.taskBoard,
    create: apiMock.taskCreate,
    update: apiMock.taskUpdate,
    toggle: apiMock.taskToggle,
    remove: apiMock.taskRemove,
  },
}));

function task(overrides: Partial<TaskItemDto>): TaskItemDto {
  return {
    id: "t-1",
    title: "任务一",
    description: "",
    done: false,
    priority: "none",
    dueAt: null,
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const BOARD = { schemaVersion: 3, tasks: [task({ id: "t-1", title: "任务一" }), task({ id: "t-2", title: "任务二" })] };

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TodoWorkspace repoPath="/mock-repo" />
    </QueryClientProvider>,
  );
}

describe("TodoWorkspace 桌面详情切换", () => {
  beforeEach(() => {
    useUiStore.setState({ focusedTaskId: null, locale: "zh-CN" });
    vi.clearAllMocks();
    apiMock.taskBoard.mockResolvedValue(BOARD);
  });

  it("点击不同任务后，右侧详情立即刷新为新任务数据", async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByText("任务一")).toBeTruthy());

    fireEvent.click(screen.getByText("任务一"));
    const titleInput = screen.getByLabelText("任务标题") as HTMLInputElement;
    expect(titleInput.value).toBe("任务一");

    fireEvent.click(screen.getByText("任务二"));
    await waitFor(() => {
      const next = screen.getByLabelText("任务标题") as HTMLInputElement;
      expect(next.value).toBe("任务二");
    });
  });
});
