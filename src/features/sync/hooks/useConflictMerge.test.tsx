import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConflictMerge } from "./useConflictMerge";

const syncApiMock = vi.hoisted(() => ({
  conflicts: vi.fn(),
  resolveFile: vi.fn(),
  push: vi.fn(),
  resolveConflict: vi.fn(),
  status: vi.fn(),
  commit: vi.fn(),
  pull: vi.fn(),
  syncNow: vi.fn(),
}));
vi.mock("@/api", () => ({ syncApi: syncApiMock }));

beforeEach(() => {
  vi.resetAllMocks();
});

const FILE = { path: "daily/a.md", local: "本地1\n本地2", remote: "远端1\n远端2" };
const STATUS = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

function renderMerge(open: boolean, onDone: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useConflictMerge("/repo", open, onDone), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("useConflictMerge", () => {
  it("加载冲突并支持行级追加与整段追加", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    const { result } = renderMerge(true, vi.fn());

    await waitFor(() => expect(result.current.merged).toBe("本地1\n本地2"));
    act(() => result.current.addLine("远端2"));
    expect(result.current.merged).toBe("本地1\n本地2\n远端2");

    act(() => result.current.appendAll(["远端1", "远端2"]));
    expect(result.current.merged).toBe("本地1\n本地2\n远端2\n远端1\n远端2");
  });

  it("保留远端立即写回该侧原文（不再需要额外点保存）", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    const { result } = renderMerge(true, vi.fn());

    await waitFor(() => expect(result.current.merged).toBe("本地1\n本地2"));
    act(() => result.current.resolveWithSide("remote"));

    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "远端1\n远端2");
    });
  });

  it("保存合并调用 resolveFile，全部解决后 push 收尾", async () => {
    syncApiMock.conflicts.mockResolvedValueOnce([FILE]).mockResolvedValue([]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    syncApiMock.push.mockResolvedValue(STATUS);
    const onDone = vi.fn();
    const { result } = renderMerge(true, onDone);

    await waitFor(() => expect(result.current.merged).toBe("本地1\n本地2"));
    act(() => result.current.saveMerge());

    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "本地1\n本地2");
    });
    await waitFor(() => {
      expect(syncApiMock.push).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalled();
    });
  });
});

describe("useConflictMerge 批量与失败路径", () => {
  it("批量保留本地调用 resolveConflict 并收尾", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveConflict.mockResolvedValue(STATUS);
    const onDone = vi.fn();
    const { result } = renderMerge(true, onDone);

    await waitFor(() => expect(result.current.merged).toBe("本地1\n本地2"));
    act(() => result.current.keepAll(true));

    await waitFor(() => {
      expect(syncApiMock.resolveConflict).toHaveBeenCalledWith(true);
      expect(onDone).toHaveBeenCalled();
    });
  });

  it("收尾推送失败只回显错误，不反复自动重发", async () => {
    syncApiMock.conflicts.mockResolvedValueOnce([FILE]).mockResolvedValue([]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    syncApiMock.push.mockRejectedValue(new Error("offline"));
    const onDone = vi.fn();
    const { result } = renderMerge(true, onDone);

    await waitFor(() => expect(result.current.merged).toBe("本地1\n本地2"));
    act(() => result.current.saveMerge());

    await waitFor(() => expect(syncApiMock.push).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(syncApiMock.push).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("没有冲突文件但仍在合并态：finishMerge 走批量命令收尾", async () => {
    syncApiMock.conflicts.mockResolvedValue([]);
    syncApiMock.resolveConflict.mockResolvedValue(STATUS);
    const onDone = vi.fn();
    const { result } = renderMerge(true, onDone);

    await waitFor(() => expect(result.current.phase).toBe("empty"));
    act(() => result.current.finishMerge());

    await waitFor(() => {
      expect(syncApiMock.resolveConflict).toHaveBeenCalledWith(true);
      expect(onDone).toHaveBeenCalled();
    });
  });

  it("列表为空且从未解决过冲突时不自动 push", async () => {
    syncApiMock.conflicts.mockResolvedValue([]);
    const { result } = renderMerge(true, vi.fn());

    await waitFor(() => expect(result.current.phase).toBe("empty"));
    expect(syncApiMock.push).not.toHaveBeenCalled();
  });
});
