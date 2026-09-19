import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import { useSessionStore } from "@/stores/session.store";
import { useRepoGraph } from "./useRepoGraph";

const restoreMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  error: null,
}));

const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn(),
}));

const COMMIT = {
  id: "a".repeat(40),
  shortId: "aaaaaaa",
  message: "first",
  author: "bob",
  timestamp: 1,
  files: [
    { path: "daily/a.md", status: "modified" },
    { path: "daily/b.md", status: "modified" },
  ],
};

vi.mock("@/queries/history.queries", () => ({
  useRepoHistoryQuery: () => ({ data: [COMMIT], isLoading: false }),
  useFileDiffQuery: () => ({ data: null }),
  useRestoreFileMutation: () => restoreMutation,
}));

vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

/** 触发恢复并立即结算 onSuccess（模拟 mutation 成功路径） */
async function restoreActiveFile(result: { current: ReturnType<typeof useRepoGraph> }) {
  restoreMutation.mutate.mockImplementation(
    (_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess(),
  );
  await act(async () => {
    await result.current.handleRestore();
  });
}

describe("useRepoGraph", () => {
  beforeEach(() => {
    restoreMutation.mutate.mockReset();
    draftMock.flushPendingDrafts.mockReset();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
    useNoteReloadStore.setState({ epoch: 0 });
    useSessionStore.setState({ currentNotePath: null });
  });

  it("恢复前先落盘未落盘草稿", async () => {
    const { result } = renderHook(() => useRepoGraph("/repo"));

    await restoreActiveFile(result);

    expect(draftMock.flushPendingDrafts).toHaveBeenCalledTimes(1);
    expect(restoreMutation.mutate).toHaveBeenCalledWith(
      { file: "daily/a.md", commitId: COMMIT.id },
      expect.any(Object),
    );
    expect(draftMock.flushPendingDrafts.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(restoreMutation.mutate.mock.invocationCallOrder[0] ?? 0);
  });

  it("草稿落盘失败时中止恢复", async () => {
    draftMock.flushPendingDrafts.mockRejectedValue(new Error("disk full"));
    const { result } = renderHook(() => useRepoGraph("/repo"));

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(restoreMutation.mutate).not.toHaveBeenCalled();
  });

  it("恢复的是当前打开的笔记时请求编辑器重载", async () => {
    useSessionStore.setState({ currentNotePath: "daily/a.md" });
    const { result } = renderHook(() => useRepoGraph("/repo"));

    await restoreActiveFile(result);

    expect(useNoteReloadStore.getState().epoch).toBe(1);
  });

  it("恢复的不是当前打开的笔记时不发重载信号", async () => {
    useSessionStore.setState({ currentNotePath: "daily/other.md" });
    const { result } = renderHook(() => useRepoGraph("/repo"));

    await restoreActiveFile(result);

    expect(useNoteReloadStore.getState().epoch).toBe(0);
  });
});
