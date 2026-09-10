import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrashItem } from "@/api/types";
import {
  useTrashDeleteMutation,
  useTrashEmptyMutation,
  useTrashListQuery,
  useTrashRestoreMutation,
} from "./trash.queries";

const trashApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
  empty: vi.fn(),
}));
vi.mock("@/api", () => ({ trashApi: trashApiMock }));

const ITEMS: TrashItem[] = [
  { id: "t-1", path: "daily/a.md", deletedAt: 100, title: "A" },
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

describe("useTrashListQuery", () => {
  it("未绑定仓库或面板关闭时不查询", () => {
    const { wrapper } = createHarness();
    const noRepo = renderHook(() => useTrashListQuery(null), { wrapper });
    const closed = renderHook(() => useTrashListQuery("/repo", false), { wrapper });

    expect(noRepo.result.current.fetchStatus).toBe("idle");
    expect(closed.result.current.fetchStatus).toBe("idle");
    expect(trashApiMock.list).not.toHaveBeenCalled();
  });

  it("面板打开时按 [trash, repoPath] 缓存条目", async () => {
    const { client, wrapper } = createHarness();
    trashApiMock.list.mockResolvedValue(ITEMS);
    const { result } = renderHook(() => useTrashListQuery("/repo"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(ITEMS);
    expect(client.getQueryData(["trash", "/repo"])).toEqual(ITEMS);
  });
});

describe("useTrashRestoreMutation", () => {
  it("恢复成功刷新 [trash]/[tree]/[notes]/[sync] 并把实际恢复路径交给回调", async () => {
    const { client, wrapper } = createHarness();
    trashApiMock.restore.mockResolvedValue("daily/a-1.md");
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const onRestored = vi.fn();
    const { result } = renderHook(() => useTrashRestoreMutation(onRestored), { wrapper });

    result.current.mutate("t-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trashApiMock.restore).toHaveBeenCalledWith("t-1");
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trash"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(onRestored).toHaveBeenCalledWith("daily/a-1.md");
  });
});

describe("useTrashDeleteMutation", () => {
  it("彻底删除只刷新 [trash]/[sync]，不触碰笔记列表", async () => {
    const { client, wrapper } = createHarness();
    trashApiMock.remove.mockResolvedValue(null);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useTrashDeleteMutation(), { wrapper });

    result.current.mutate("t-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trash"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
  });
});

describe("useTrashEmptyMutation", () => {
  it("清空回收站只刷新 [trash]/[sync]", async () => {
    const { client, wrapper } = createHarness();
    trashApiMock.empty.mockResolvedValue(null);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useTrashEmptyMutation(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trashApiMock.empty).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trash"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
  });
});
