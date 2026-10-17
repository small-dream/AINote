import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import { useConvertMentionsMutation, useWikiIndexQuery } from "./wiki.queries";

const wikiApiMock = vi.hoisted(() => ({ index: vi.fn(), convertMentions: vi.fn() }));
vi.mock("@/api", () => ({ wikiApi: wikiApiMock }));

const INDEX: NoteWikiDto[] = [
  { path: "a.md", title: "A", aliases: [], headings: [], tags: ["前端"], links: ["b"] },
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

describe("useConvertMentionsMutation", () => {
  it("转换成功后等待 note-content 全量重取，再结束 mutation", async () => {
    const { client, wrapper } = createHarness();
    wikiApiMock.convertMentions.mockResolvedValue(1);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useConvertMentionsMutation("/repo", "plan.md"), { wrapper });

    await act(() => result.current.mutateAsync([{ sourcePath: "source.md", term: "项目计划", occurrence: 0 }]));

    expect(wikiApiMock.convertMentions).toHaveBeenCalledWith("plan.md", [{ sourcePath: "source.md", term: "项目计划", occurrence: 0 }]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["note-content"], refetchType: "all" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki-mentions", "/repo", "plan.md"] });
  });
});
