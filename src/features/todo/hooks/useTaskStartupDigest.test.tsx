import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskBoardDto, TaskItemDto } from "@/api/types";
import { useUiStore } from "@/stores/ui.store";
import { digestDateKey, msUntilNextLocalDay } from "../utils/startupDigest";
import { STARTUP_DIGEST_STORAGE_KEY } from "../utils/startupDigestLog";
import { useTaskStartupDigest } from "./useTaskStartupDigest";

const apiMock = vi.hoisted(() => ({ taskBoard: vi.fn() }));
vi.mock("@/api", () => ({ taskApi: { board: apiMock.taskBoard } }));

/** 2026-09-16 10:00 本地时间 */
const NOW = new Date(2026, 8, 16, 10, 0);
const NEXT_DAY = new Date(2026, 8, 17, 9, 0);

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "task-1",
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

function board(tasks: TaskItemDto[]): TaskBoardDto {
  return { schemaVersion: 3, tasks };
}

/** 缓存常驻 + 不因窗口聚焦重取：让「有没有数据」与「该不该提示」两件事互相独立 */
function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } } });
}

function setup(repoPath: string | null, client = makeClient()) {
  return renderHook((path: string | null) => useTaskStartupDigest(path), {
    initialProps: repoPath,
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

/** 等任务板查询跑完并让结果落到渲染里 */
async function settle() {
  await waitFor(() => expect(apiMock.taskBoard).toHaveBeenCalled());
  await act(async () => {});
  await act(async () => {});
}

function storedKeys(): string[] {
  return Object.keys(JSON.parse(localStorage.getItem(STARTUP_DIGEST_STORAGE_KEY) ?? "{}") as Record<string, string>);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  useUiStore.setState({ sidebarTab: "tree", focusedTaskId: null });
  apiMock.taskBoard.mockResolvedValue(board([task()]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTaskStartupDigest", () => {
  it("首次进入工作区时展示摘要卡，并记下当天已提示", async () => {
    const { result } = setup("/mock-repo");
    await waitFor(() => expect(result.current?.digest.total).toBe(1));
    expect(result.current?.digest.overdueCount).toBe(1);
    await waitFor(() => expect(storedKeys()).toEqual([digestDateKey("/mock-repo", NOW)]));
  });

  it("同一天再次进入（重启 / 重挂）不再提示", async () => {
    const client = makeClient();
    const first = setup("/mock-repo", client);
    await waitFor(() => expect(first.result.current).not.toBeNull());
    first.unmount();

    // 同一份缓存：第二次挂载时数据就在手上，没有卡片只可能是「当天已提示」
    expect(client.getQueryData(["tasks", "/mock-repo"])).toBeDefined();
    const second = setup("/mock-repo", client);
    await settle();
    expect(second.result.current).toBeNull();
  });

  it("切换仓库各自计时", async () => {
    const { result, rerender } = setup("/mock-repo");
    await waitFor(() => expect(result.current).not.toBeNull());

    rerender("/repo-b");
    await waitFor(() => expect(result.current?.digest.total).toBe(1));
    await waitFor(() => expect(storedKeys()).toHaveLength(2));
  });

  it("跨天回到前台后重新提示", async () => {
    const { result } = setup("/mock-repo");
    await waitFor(() => expect(result.current).not.toBeNull());

    vi.setSystemTime(NEXT_DAY);
    await act(async () => { window.dispatchEvent(new Event("focus")); });

    await waitFor(() => expect(result.current?.digest.total).toBe(1));
    await waitFor(() => expect(storedKeys()).toHaveLength(2));
  });

  it("没有待处理任务时不展示，也不记提示", async () => {
    apiMock.taskBoard.mockResolvedValue(board([task({ dueAt: "2026-09-20" }), task({ id: "done", done: true, dueAt: "2026-09-01" })]));
    const { result } = setup("/mock-repo");
    await settle();
    expect(result.current).toBeNull();
    expect(storedKeys()).toEqual([]);
  });

  it("窗口不可见时只等回到前台再提示", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      const { result } = setup("/mock-repo");
      await settle();
      expect(result.current).toBeNull();
      expect(storedKeys()).toEqual([]);
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
  });

});

describe("useTaskStartupDigest 的跨天重评", () => {
  it("挂机跨过本地午夜后重新提示，无需重新打开应用", async () => {
    const { result } = setup("/mock-repo");
    await waitFor(() => expect(result.current).not.toBeNull());
    act(() => result.current?.onDismiss());
    expect(result.current).toBeNull();

    vi.setSystemTime(NEXT_DAY);
    await act(async () => { vi.advanceTimersByTime(msUntilNextLocalDay(NOW)); });

    await waitFor(() => expect(result.current?.digest.total).toBe(1));
    await waitFor(() => expect(storedKeys()).toHaveLength(2));
  });
});

describe("useTaskStartupDigest 的卡片动作", () => {
  it("「查看待办」定位到最紧要的一条并收起卡片", async () => {
    apiMock.taskBoard.mockResolvedValue(board([task({ id: "today", dueAt: "2026-09-16T18:00" }), task({ id: "old", dueAt: "2026-09-10" })]));
    const { result } = setup("/mock-repo");
    await waitFor(() => expect(result.current?.digest.total).toBe(2));
    expect(result.current?.digest.items.map((item) => item.id)).toEqual(["old", "today"]);

    act(() => result.current?.onView());

    expect(useUiStore.getState().sidebarTab).toBe("todo");
    expect(useUiStore.getState().focusedTaskId).toBe("old");
    expect(result.current).toBeNull();
  });

  it("关闭后当天不再出现", async () => {
    const { result } = setup("/mock-repo");
    await waitFor(() => expect(result.current).not.toBeNull());

    act(() => result.current?.onDismiss());
    expect(result.current).toBeNull();

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(result.current).toBeNull();
  });

  it("任务清空后卡片自动收起", async () => {
    const client = makeClient();
    const { result } = setup("/mock-repo", client);
    await waitFor(() => expect(result.current).not.toBeNull());

    await act(async () => {
      client.setQueryData(["tasks", "/mock-repo"], board([task({ done: true })]));
    });
    await act(async () => {});
    await waitFor(() => expect(result.current).toBeNull());
  });
});
