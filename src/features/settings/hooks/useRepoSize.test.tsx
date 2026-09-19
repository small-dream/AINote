import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useRepoSize } from "./useRepoSize";

const repoApiMock = vi.hoisted(() => ({
  size: vi.fn(),
}));
vi.mock("@/api", () => ({ repoApi: repoApiMock }));

function createHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useRepoSize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({ repoPath: "/repo-a" });
  });

  it("查询键带 repoPath：切仓后重新拉取，不展示旧仓库数据", async () => {
    repoApiMock.size.mockImplementation(async () =>
      useSessionStore.getState().repoPath === "/repo-a" ? { bytes: 100 } : { bytes: 200 },
    );
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useRepoSize(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ bytes: 100 }));
    expect(repoApiMock.size).toHaveBeenCalledTimes(1);

    act(() => useSessionStore.getState().switchRepo("/repo-b"));

    await waitFor(() => expect(result.current.data).toEqual({ bytes: 200 }));
    expect(repoApiMock.size).toHaveBeenCalledTimes(2);
  });
});
