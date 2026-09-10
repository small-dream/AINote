import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncProgress, SyncStatus } from "@/api/types";
import { useSyncRetryStore } from "@/stores/sync-retry.store";
import { useSyncNowMutation } from "./sync.queries";

const syncApiMock = vi.hoisted(() => ({ syncNow: vi.fn() }));
vi.mock("@/api", () => ({ syncApi: syncApiMock }));

const STATUS: SyncStatus = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSyncNowMutation", () => {
  beforeEach(() => {
    useSyncRetryStore.getState().clear();
    vi.clearAllMocks();
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
