import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus } from "@/api/types";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";
import {
  noteKeys,
  useCreateNoteMutation,
  useConvertNoteMutation,
  useDeleteNoteMutation,
  useImportNoteMutation,
  useMoveNoteMutation,
  useNoteListQuery,
  useUpdateNoteMutation,
} from "./note.queries";

const noteApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
  importFromMarkdown: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
  convert: vi.fn(),
}));
vi.mock("@/api", () => ({ noteApi: noteApiMock }));

const STATUS: SyncStatus = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

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

describe("useUpdateNoteMutation", () => {
  it("[notes]/[wiki] 只标记过期（refetchType none），[sync] 即时刷新，并回写 note-content 缓存", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.update.mockResolvedValue(null);
    client.setQueryData(noteKeys.content("/repo", "a.md"), { path: "a.md", kind: "markdown", content: "旧内容" });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const versionBefore = useWorkspaceActivityStore.getState().version;
    const { result } = renderHook(() => useUpdateNoteMutation("/repo"), { wrapper });

    result.current.mutate({ path: "a.md", content: "新内容" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"], refetchType: "none" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"], refetchType: "none" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(client.getQueryData(noteKeys.content("/repo", "a.md"))).toEqual({
      path: "a.md",
      kind: "markdown",
      content: "新内容",
    });
    expect(useWorkspaceActivityStore.getState().version).toBe(versionBefore + 1);
  });

  it("活跃的 [notes] 查询不立即重取、仅标记过期，[sync] 立即重取", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.list.mockResolvedValue([]);
    noteApiMock.update.mockResolvedValue(null);
    const syncFetch = vi.fn().mockResolvedValue(STATUS);
    const listHook = renderHook(() => useNoteListQuery("/repo"), { wrapper });
    renderHook(() => useQuery({ queryKey: ["sync", "/repo"], queryFn: syncFetch }), { wrapper });
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(syncFetch).toHaveBeenCalledTimes(1));

    const mutation = renderHook(() => useUpdateNoteMutation("/repo"), { wrapper });
    mutation.result.current.mutate({ path: "a.md", content: "新内容" });
    await waitFor(() => expect(mutation.result.current.isSuccess).toBe(true));

    await waitFor(() => expect(syncFetch).toHaveBeenCalledTimes(2));
    expect(noteApiMock.list).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(noteKeys.list("/repo"))?.isInvalidated).toBe(true);
  });

  it("note-content 无缓存时写入新的内容对象", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.update.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdateNoteMutation("/repo"), { wrapper });

    result.current.mutate({ path: "fresh.md", content: "首次保存" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.getQueryData(noteKeys.content("/repo", "fresh.md"))).toEqual({
      path: "fresh.md",
      content: "首次保存",
    });
  });
});

describe("useCreateNoteMutation", () => {
  it("创建成功刷新 [notes]/[tree]/[wiki]/[sync] 并移除 note-content 缓存", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.create.mockResolvedValue({ path: "new.md", kind: "markdown", title: "new", updatedAt: 1 });
    client.setQueryData(noteKeys.content("/repo", "old.md"), { path: "old.md", kind: "markdown", content: "旧" });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const removeSpy = vi.spyOn(client, "removeQueries");
    const { result } = renderHook(() => useCreateNoteMutation(), { wrapper });

    result.current.mutate({ path: "new.md", kind: "markdown", content: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(noteApiMock.create).toHaveBeenCalledWith("new.md", "markdown", null);
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: ["note-content"] });
    expect(client.getQueryData(noteKeys.content("/repo", "old.md"))).toBeUndefined();
  });
});

describe("useImportNoteMutation", () => {
  it("导入成功刷新 [notes]/[tree]/[sync] 并标记工作区活动", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.importFromMarkdown.mockResolvedValue({ path: "导入.md", kind: "markdown", title: "导入", updatedAt: 1 });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const versionBefore = useWorkspaceActivityStore.getState().version;
    const { result } = renderHook(() => useImportNoteMutation(), { wrapper });

    result.current.mutate({ dir: "daily", fileName: "导入.md", content: "# 导入" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(noteApiMock.importFromMarkdown).toHaveBeenCalledWith("daily", "导入.md", "# 导入");
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(useWorkspaceActivityStore.getState().version).toBe(versionBefore + 1);
  });
});

describe("useDeleteNoteMutation", () => {
  it("删除前取消进行中的 [tree]/[notes] 查询，成功后刷新并回调 onDeleted", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.remove.mockResolvedValue(null);
    const cancelSpy = vi.spyOn(client, "cancelQueries");
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const removeQueriesSpy = vi.spyOn(client, "removeQueries");
    const onDeleted = vi.fn();
    const versionBefore = useWorkspaceActivityStore.getState().version;
    const { result } = renderHook(() => useDeleteNoteMutation(onDeleted), { wrapper });

    result.current.mutate("daily/a.md");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: ["note-content"] });
    expect(onDeleted).toHaveBeenCalledWith("daily/a.md");
    expect(useWorkspaceActivityStore.getState().version).toBe(versionBefore + 1);
  });
});

describe("useMoveNoteMutation", () => {
  it("移动成功刷新 [notes]/[tree]/[wiki]/[sync] 并标记工作区活动", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.move.mockResolvedValue(null);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const versionBefore = useWorkspaceActivityStore.getState().version;
    const { result } = renderHook(() => useMoveNoteMutation(), { wrapper });

    result.current.mutate({ from: "a.md", to: "daily/a.md" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(noteApiMock.move).toHaveBeenCalledWith("a.md", "daily/a.md");
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(useWorkspaceActivityStore.getState().version).toBe(versionBefore + 1);
  });
});

describe("useConvertNoteMutation", () => {
  it("转换成功刷新 [notes]/[tree]/[wiki]/[sync] 并标记工作区活动", async () => {
    const { client, wrapper } = createHarness();
    noteApiMock.convert.mockResolvedValue(null);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const versionBefore = useWorkspaceActivityStore.getState().version;
    const { result } = renderHook(() => useConvertNoteMutation(), { wrapper });

    result.current.mutate({ from: "a.md", to: "a.ainote", content: "{}" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(noteApiMock.convert).toHaveBeenCalledWith("a.md", "a.ainote", "{}");
    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tree"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wiki"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sync"] });
    expect(useWorkspaceActivityStore.getState().version).toBe(versionBefore + 1);
  });
});
