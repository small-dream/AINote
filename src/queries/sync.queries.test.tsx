import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncProgress, SyncStatus } from "@/api/types";
import { useSyncRetryStore } from "@/stores/sync-retry.store";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import {
  useCommitPendingMutation,
  useResolveConflictMutation,
  useResolveFileMutation,
  useSyncNowMutation,
} from "./sync.queries";

const syncApiMock = vi.hoisted(() => ({
  syncNow: vi.fn(),
  commit: vi.fn(),
  resolveConflict: vi.fn(),
  resolveFile: vi.fn(),
}));
vi.mock("@/api", () => ({ syncApi: syncApiMock }));

const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn(),
  hasPendingDraft: vi.fn(),
}));
vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

const STATUS: SyncStatus = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function createHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const harnessWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper: harnessWrapper };
}

/** 工作区写入后必须失效的完整读取面（与 invalidateWorkspaceQueries 对齐） */
const WORKSPACE_KEYS = [
  ["sync"],
  ["notes"],
  ["note-content"],
  ["tree"],
  ["wiki"],
  ["favorites"],
  ["tasks"],
  ["history"],
  ["repo-history"],
  ["changed-files"],
];

describe("useSyncNowMutation", () => {
  beforeEach(() => {
    useSyncRetryStore.getState().clear();
    useNoteReloadStore.setState({ epoch: 0 });
    vi.clearAllMocks();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
    draftMock.hasPendingDraft.mockReturnValue(false);
  });

  it("默认把拉取重试进度写入全局重试态，结算后清空", async () => {
    syncApiMock.syncNow.mockImplementation(async (onProgress?: (progress: SyncProgress) => void) => {
      onProgress?.({ phase: "retrying", retry: 1, maxRetries: 3, delayMs: 500 });
      return STATUS;
    });
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useSyncRetryStore.getState().progress).toBeNull();
  });

  it("等待期间重试态可被界面读取", async () => {
    let finish: (status: SyncStatus) => void = () => undefined;
    syncApiMock.syncNow.mockImplementation((onProgress?: (progress: SyncProgress) => void) => {
      onProgress?.({ phase: "retrying", retry: 2, maxRetries: 3, delayMs: 1000 });
      return new Promise<SyncStatus>((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() =>
      expect(useSyncRetryStore.getState().progress).toEqual({
        retry: 2,
        maxRetries: 3,
        delayMs: 1000,
      }),
    );

    finish(STATUS);
    await waitFor(() => expect(useSyncRetryStore.getState().progress).toBeNull());
  });

  it("失败时同样清空重试态并保留错误", async () => {
    syncApiMock.syncNow.mockImplementation((onProgress?: (progress: SyncProgress) => void) => {
      onProgress?.({ phase: "retrying", retry: 3, maxRetries: 3, delayMs: 2000 });
      return Promise.reject({ code: "SYNC_4002", kind: "network", message: "超时", retriable: true });
    });
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useSyncRetryStore.getState().progress).toBeNull();
  });
});

describe("useSyncNowMutation 草稿落盘与失效面", () => {
  beforeEach(() => {
    useSyncRetryStore.getState().clear();
    useNoteReloadStore.setState({ epoch: 0 });
    vi.clearAllMocks();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
    draftMock.hasPendingDraft.mockReturnValue(false);
  });

  it("同步前先落盘未落盘草稿（commit→pull→push 会改写工作区）", async () => {
    syncApiMock.syncNow.mockResolvedValue(STATUS);
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(draftMock.flushPendingDrafts).toHaveBeenCalledTimes(1);
    expect(draftMock.flushPendingDrafts.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(syncApiMock.syncNow.mock.invocationCallOrder[0] ?? 0);
  });

  it("草稿落盘失败时不发起同步", async () => {
    draftMock.flushPendingDrafts.mockRejectedValue(new Error("disk full"));
    syncApiMock.syncNow.mockResolvedValue(STATUS);
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(syncApiMock.syncNow).not.toHaveBeenCalled();
  });

  it("成功后失效整个工作区读取面，并在无脏草稿时请求编辑器重载", async () => {
    syncApiMock.syncNow.mockResolvedValue(STATUS);
    const { client, wrapper: harnessWrapper } = createHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper: harnessWrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const key of WORKSPACE_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    }
    expect(useNoteReloadStore.getState().epoch).toBe(1);
  });

  it("有脏草稿时同步成功也不发出编辑器重载信号（保留用户输入）", async () => {
    draftMock.hasPendingDraft.mockReturnValue(true);
    syncApiMock.syncNow.mockResolvedValue(STATUS);
    const { result } = renderHook(() => useSyncNowMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(useNoteReloadStore.getState().epoch).toBe(0);
  });
});

describe("useCommitPendingMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("提交成功后失效 [sync] 与 [changed-files]（待提交面板立即清空）", async () => {
    syncApiMock.commit.mockResolvedValue(undefined);
    const { client, wrapper: harnessWrapper } = createHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCommitPendingMutation(), { wrapper: harnessWrapper });

    result.current.mutate("note: update a.md");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(syncApiMock.commit).toHaveBeenCalledWith("note: update a.md");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["changed-files"] });
  });
});

describe("useResolveConflictMutation", () => {
  beforeEach(() => {
    useNoteReloadStore.setState({ epoch: 0 });
    vi.clearAllMocks();
    draftMock.hasPendingDraft.mockReturnValue(false);
  });

  it("批量解决后失效冲突列表与整个工作区读取面，并请求编辑器重载", async () => {
    syncApiMock.resolveConflict.mockResolvedValue(undefined);
    const { client, wrapper: harnessWrapper } = createHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useResolveConflictMutation(), { wrapper: harnessWrapper });

    result.current.mutate(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conflicts"] });
    for (const key of WORKSPACE_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    }
    expect(useNoteReloadStore.getState().epoch).toBe(1);
  });
});

describe("useResolveFileMutation", () => {
  beforeEach(() => {
    useNoteReloadStore.setState({ epoch: 0 });
    vi.clearAllMocks();
    draftMock.hasPendingDraft.mockReturnValue(false);
  });

  it("按文件写回合并内容后失效冲突列表与整个工作区读取面", async () => {
    syncApiMock.resolveFile.mockResolvedValue(undefined);
    const { client, wrapper: harnessWrapper } = createHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useResolveFileMutation(), { wrapper: harnessWrapper });

    result.current.mutate({ path: "a.md", content: "# 合并结果" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conflicts"] });
    for (const key of WORKSPACE_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    }
    expect(useNoteReloadStore.getState().epoch).toBe(1);
  });
});
