import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteSaveQueue } from "./useNoteSaveQueue";

const mutateAsync = vi.fn();
const reset = vi.fn();

vi.mock("@/queries/note.queries", () => ({
  useUpdateNoteMutation: () => ({ mutateAsync, reset, error: null }),
}));

function setup(overrides: Partial<Parameters<typeof useNoteSaveQueue>[0]> = {}) {
  const setDirty = vi.fn();
  const options = {
    repoPath: "/repo",
    notePath: "note.md",
    draft: "# hello",
    dirty: true,
    setDirty,
    isLoaded: () => true,
    debounceMs: 60_000,
    ...overrides,
  };
  return { ...renderHook(() => useNoteSaveQueue(options)), setDirty };
}

beforeEach(() => {
  mutateAsync.mockReset();
  reset.mockReset();
  mutateAsync.mockResolvedValue(null);
});

describe("useNoteSaveQueue", () => {
  it("防抖到期后自动保存最新内容", async () => {
    vi.useFakeTimers();
    try {
      setup({ debounceMs: 3_000 });
      await act(async () => { vi.advanceTimersByTime(2_999); });
      expect(mutateAsync).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(mutateAsync).toHaveBeenCalledWith({ path: "note.md", content: "# hello" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("保存成功后才清除 dirty，并传递最新内容", async () => {
    const { result, setDirty } = setup();

    await act(async () => {
      await result.current.flush();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ path: "note.md", content: "# hello" });
    expect(setDirty).toHaveBeenCalledWith(false);
  });

  it("保存失败时保留 dirty，并允许再次 flush 重试", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce(null);
    const { result, setDirty } = setup();

    await expect(result.current.flush()).rejects.toThrow("disk full");
    expect(setDirty).not.toHaveBeenCalledWith(false);

    await act(async () => {
      await result.current.flush();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(setDirty).toHaveBeenCalledWith(false);
  });

  it("笔记切换时清理旧的 mutation 错误状态", async () => {
    const { rerender } = setup();
    rerender();
    await waitFor(() => expect(reset).toHaveBeenCalled());
  });
});
