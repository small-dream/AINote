import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTreeSearch } from "./useTreeSearch";

const searchApiMock = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock("@/api", () => ({
  searchApi: searchApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderSearch(repoPath: string | null, query: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useTreeSearch(repoPath, query), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useTreeSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("防抖后触发全文搜索并返回结果", async () => {
    searchApiMock.search.mockResolvedValue([
      { path: "a.md", title: "A", snippet: "x", line: 1, updatedAt: 1 },
    ]);
    const { result } = renderSearch("/tmp/repo", "rust");

    expect(result.current.isSearching).toBe(true);
    expect(searchApiMock.search).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(searchApiMock.search).toHaveBeenCalledWith("rust");
    });
    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
      expect(result.current.isSearching).toBe(false);
    });
  });

  it("空查询不触发搜索", async () => {
    const { result } = renderSearch("/tmp/repo", "  ");

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });
    expect(searchApiMock.search).not.toHaveBeenCalled();
  });
});
