import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteSaveQueue } from "./useNoteSaveQueue";

const mutateAsync = vi.fn();
const reset = vi.fn();

/** 真实调用方的 isLoaded 来自 useNoteReload 的 useCallback（稳定引用），测试保持同样形状。 */
const stableLoaded = () => true;

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

/** 连续输入场景共用：draft 可变、isLoaded 与真实调用方一致为稳定引用 */
function renderContinuousDraft(setDirty: (dirty: boolean) => void, initialDraft: string) {
  return renderHook(
    ({ draft }: { draft: string }) =>
      useNoteSaveQueue({
        repoPath: "/repo",
        notePath: "note.md",
        draft,
        dirty: true,
        setDirty,
        isLoaded: stableLoaded,
        debounceMs: 3_000,
      }),
    { initialProps: { draft: initialDraft } },
  );
}

describe("useNoteSaveQueue 落盘时机", () => {
  it("连续输入不重置计时器：按首次变更起算 3 秒落盘（最长 3 秒延迟）", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderContinuousDraft(vi.fn(), "# 第一段");

      await act(async () => { vi.advanceTimersByTime(2_000); });
      rerender({ draft: "# 第一段第二段" });
      await act(async () => { vi.advanceTimersByTime(999); });
      expect(mutateAsync).not.toHaveBeenCalled();

      await act(async () => { vi.advanceTimersByTime(1); });
      expect(mutateAsync).toHaveBeenCalledWith({ path: "note.md", content: "# 第一段第二段" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useNoteSaveQueue 保存后重新武装", () => {
  it("保存 in-flight 期间 draft 继续前进时，完成后重新武装防抖并再次保存", async () => {
    vi.useFakeTimers();
    try {
      let resolveSave: (value: null) => void = () => undefined;
      mutateAsync
        .mockImplementationOnce(() => new Promise<null>((resolve) => { resolveSave = resolve; }))
        .mockResolvedValue(null);
      const setDirty = vi.fn();
      const { rerender } = renderContinuousDraft(setDirty, "# 第一版");

      // 首次防抖触发保存，保存挂起期间用户继续输入
      await act(async () => { vi.advanceTimersByTime(3_000); });
      expect(mutateAsync).toHaveBeenCalledWith({ path: "note.md", content: "# 第一版" });
      rerender({ draft: "# 第一版加新内容" });

      // 保存完成：draft 已前进 → 不清 dirty，并重新武装下一轮防抖
      await act(async () => { resolveSave(null); });
      expect(setDirty).not.toHaveBeenCalledWith(false);
      await act(async () => { vi.advanceTimersByTime(2_999); });
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      await act(async () => { vi.advanceTimersByTime(1); });
      expect(mutateAsync).toHaveBeenCalledWith({ path: "note.md", content: "# 第一版加新内容" });
    } finally {
      vi.useRealTimers();
    }
  });
});
