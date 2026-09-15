import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus } from "@/api/types";
import { useSyncStatusQuery } from "./sync.queries";
import { useTaskCreateMutation, useTaskToggleMutation } from "./task.queries";

const apiMock = vi.hoisted(() => ({
  syncStatus: vi.fn(),
  taskCreate: vi.fn(),
  taskToggle: vi.fn(),
}));
vi.mock("@/api", () => ({
  syncApi: { status: apiMock.syncStatus },
  taskApi: { create: apiMock.taskCreate, toggle: apiMock.taskToggle },
}));

const CLEAN: SyncStatus = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };
const DIRTY: SyncStatus = { ahead: 0, behind: 0, hasUncommitted: true, conflicted: false };

const TASK = {
  id: "task-1",
  title: "写周报",
  description: "",
  done: false,
  priority: "none" as const,
  dueAt: null,
  remindAt: null,
  sortOrder: 0,
  createdAt: "2026-09-16T10:00:00Z",
  updatedAt: "2026-09-16T10:00:00Z",
  completedAt: null,
};

/** 同时挂载同步状态查询与待办写入用例，验证写入后「待提交」状态会被重新拉取。 */
function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(
    () => ({ status: useSyncStatusQuery("/mock-repo"), create: useTaskCreateMutation(), toggle: useTaskToggleMutation() }),
    { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
  );
}

describe("待办写入后的同步状态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.syncStatus.mockResolvedValueOnce(CLEAN).mockResolvedValue(DIRTY);
    apiMock.taskCreate.mockResolvedValue(TASK);
    apiMock.taskToggle.mockResolvedValue({ ...TASK, done: true });
  });

  it("新建任务后重新拉取同步状态，待提交徽标随之出现", async () => {
    const { result } = renderWorkspace();
    await waitFor(() => expect(result.current.status.data).toEqual(CLEAN));

    act(() => result.current.create.mutate({ title: "写周报", description: "", dueAt: null, priority: "none", remindAt: null }));

    await waitFor(() => expect(result.current.status.data).toEqual(DIRTY));
  });

  it("勾选完成同样重新拉取同步状态", async () => {
    const { result } = renderWorkspace();
    await waitFor(() => expect(result.current.status.data).toEqual(CLEAN));

    act(() => result.current.toggle.mutate("task-1"));

    await waitFor(() => expect(result.current.status.data).toEqual(DIRTY));
  });
});
