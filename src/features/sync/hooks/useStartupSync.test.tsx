import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStartupSync } from "./useStartupSync";

const syncApiMock = vi.hoisted(() => ({
  pull: vi.fn(),
  syncNow: vi.fn(),
}));

vi.mock("@/api", () => ({ syncApi: syncApiMock }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => true }));

const SYNC_STATUS = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useStartupSync", () => {
  beforeEach(() => {
    syncApiMock.pull.mockReset().mockResolvedValue(SYNC_STATUS);
    syncApiMock.syncNow.mockReset().mockResolvedValue(SYNC_STATUS);
  });

  it("启动时只拉取远端，不触发提交/推送式同步", async () => {
    renderHook(() => useStartupSync("/repo"), { wrapper });

    await waitFor(() => expect(syncApiMock.pull).toHaveBeenCalledTimes(1));
    expect(syncApiMock.syncNow).not.toHaveBeenCalled();
  });

  it("未绑定仓库时不发起拉取", () => {
    renderHook(() => useStartupSync(null), { wrapper });

    expect(syncApiMock.pull).not.toHaveBeenCalled();
  });
});
