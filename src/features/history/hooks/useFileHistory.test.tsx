import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileHistory } from "./useFileHistory";

const restoreMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  error: null,
}));

const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn(),
}));

vi.mock("@/queries/history.queries", () => ({
  useFileHistoryQuery: () => ({
    data: [{ id: "a".repeat(40), shortId: "aaaaaaa", message: "first", author: "bob", timestamp: 1 }],
  }),
  useFileDiffQuery: () => ({ data: null }),
  useRestoreFileMutation: () => restoreMutation,
}));

vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

function setup() {
  const onRestored = vi.fn();
  const onClose = vi.fn();
  const hook = renderHook(() =>
    useFileHistory({ repoPath: "/repo", path: "daily/a.md", open: true, onClose, onRestored }),
  );
  return { ...hook, onRestored, onClose };
}

describe("useFileHistory", () => {
  beforeEach(() => {
    restoreMutation.mutate.mockReset();
    draftMock.flushPendingDrafts.mockReset();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
  });

  it("恢复前先落盘未落盘草稿（对齐关窗/绑仓范式）", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(draftMock.flushPendingDrafts).toHaveBeenCalledTimes(1);
    expect(restoreMutation.mutate).toHaveBeenCalledWith(
      { file: "daily/a.md", commitId: "a".repeat(40) },
      expect.any(Object),
    );
    expect(draftMock.flushPendingDrafts.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(restoreMutation.mutate.mock.invocationCallOrder[0] ?? 0);
  });

  it("草稿落盘失败时中止恢复（草稿是仅存副本）", async () => {
    draftMock.flushPendingDrafts.mockRejectedValue(new Error("disk full"));
    const { result } = setup();

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(restoreMutation.mutate).not.toHaveBeenCalled();
  });
});
