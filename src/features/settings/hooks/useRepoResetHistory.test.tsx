import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepoResetHistory } from "./useRepoResetHistory";

const repoApiMock = vi.hoisted(() => ({ resetHistory: vi.fn() }));
vi.mock("@/api", () => ({ repoApi: repoApiMock }));

describe("useRepoResetHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("重置成功后作废历史、同步与仓库大小缓存", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    repoApiMock.resetHistory.mockResolvedValue({
      commitId: "abc",
      branch: "main",
      erasedCommits: 3,
      fileCount: 5,
      pushed: true,
      backupCleanupFailed: false,
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRepoResetHistory(), { wrapper });
    result.current.mutate("note: reset history");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
    expect(keys).toContain(JSON.stringify(["sync"]));
    expect(keys).toContain(JSON.stringify(["repo-history"]));
    expect(keys).toContain(JSON.stringify(["history"]));
    expect(keys).toContain(JSON.stringify(["repos"]));
  });
});
