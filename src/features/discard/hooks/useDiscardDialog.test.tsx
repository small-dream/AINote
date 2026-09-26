import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import { useSessionStore } from "@/stores/session.store";
import { useDiscardDialog } from "./useDiscardDialog";

const syncApiMock = vi.hoisted(() => ({ statusFiles: vi.fn(), discard: vi.fn() }));

vi.mock("@/api", () => ({
  syncApi: syncApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const draftMock = vi.hoisted(() => ({ flushPendingDrafts: vi.fn(), hasPendingDraft: vi.fn() }));
vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

const FILES = [
  { path: "a.md", status: "modified" as const },
  { path: "b.md", status: "added" as const },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function setup(onClose = vi.fn()) {
  const hook = renderHook(() => useDiscardDialog("/repo", onClose), { wrapper });
  await waitFor(() => expect(hook.result.current.files.length).toBe(2));
  return { ...hook, onClose };
}

describe("useDiscardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
    useNoteReloadStore.setState({ epoch: 0, forcedEpoch: 0 });
    useSessionStore.setState({ repoPath: "/repo", currentNotePath: null, login: null, workspaceEpoch: 0 });
  });

  it("全选与逐项勾选互斥，且按状态统计恢复 / 删除数量", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    const { result } = await setup();

    expect(result.current.allSelected).toBe(false);
    act(() => result.current.toggleAll());
    await waitFor(() => expect(result.current.allSelected).toBe(true));
    expect(result.current.restoreCount).toBe(1);
    expect(result.current.deleteCount).toBe(1);

    act(() => result.current.toggle("a.md"));
    await waitFor(() => expect(result.current.selectedCount).toBe(1));
    expect(result.current.allSelected).toBe(false);

    act(() => result.current.toggleAll());
    await waitFor(() => expect(result.current.selectedCount).toBe(2));

    act(() => result.current.toggleAll());
    await waitFor(() => expect(result.current.selectedCount).toBe(0));
  });

  it("丢弃前先落盘草稿，成功后请求强制重载并关闭面板", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.discard.mockResolvedValue({ restored: ["a.md"], deleted: ["b.md"], skipped: [] });
    const { result, onClose } = await setup();

    act(() => result.current.toggleAll());
    await waitFor(() => expect(result.current.selectedCount).toBe(2));
    act(() => result.current.submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(draftMock.flushPendingDrafts).toHaveBeenCalled();
    expect(syncApiMock.discard).toHaveBeenCalledWith(["a.md", "b.md"]);
    expect(useNoteReloadStore.getState().forcedEpoch).toBe(1);
  });

  it("当前笔记本身被彻底删除时回到列表", async () => {
    useSessionStore.setState({ currentNotePath: "b.md" });
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.discard.mockResolvedValue({ restored: [], deleted: ["b.md"], skipped: [] });
    const { result } = await setup();

    act(() => result.current.toggle("b.md"));
    await waitFor(() => expect(result.current.selectedCount).toBe(1));
    act(() => result.current.submit());

    await waitFor(() => expect(useSessionStore.getState().currentNotePath).toBeNull());
  });

  it("打开确认框后可取消，取消不触发丢弃", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    const { result } = await setup();

    act(() => result.current.toggleAll());
    act(() => result.current.openConfirm());
    await waitFor(() => expect(result.current.confirming).toBe(true));
    act(() => result.current.closeConfirm());
    await waitFor(() => expect(result.current.confirming).toBe(false));
    expect(syncApiMock.discard).not.toHaveBeenCalled();
  });
});
