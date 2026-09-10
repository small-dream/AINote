import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import { useWikiIndexQuery } from "./wiki.queries";

const wikiApiMock = vi.hoisted(() => ({ index: vi.fn() }));
vi.mock("@/api", () => ({ wikiApi: wikiApiMock }));

const INDEX: NoteWikiDto[] = [
  { path: "a.md", title: "A", tags: ["前端"], links: ["b"] },
];

function createHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWikiIndexQuery", () => {
  it("未绑定仓库时不发起全仓扫描", async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useWikiIndexQuery(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(wikiApiMock.index).not.toHaveBeenCalled();
  });

  it("绑定仓库后按 [wiki, repoPath] 缓存索引", async () => {
    const { client, wrapper } = createHarness();
    wikiApiMock.index.mockResolvedValue(INDEX);
    const { result } = renderHook(() => useWikiIndexQuery("/repo"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(INDEX);
    expect(client.getQueryData(["wiki", "/repo"])).toEqual(INDEX);
  });

  it("[wiki] 前缀失效时活跃索引立即重取（创建/更新笔记的联动契约）", async () => {
    const { client, wrapper } = createHarness();
    wikiApiMock.index.mockResolvedValue(INDEX);
    const { result } = renderHook(() => useWikiIndexQuery("/repo"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(wikiApiMock.index).toHaveBeenCalledTimes(1);

    await client.invalidateQueries({ queryKey: ["wiki"] });
    await waitFor(() => expect(wikiApiMock.index).toHaveBeenCalledTimes(2));
  });
});
