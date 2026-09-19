import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTreeContextMenu } from "./useTreeContextMenu";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useTreeContextMenu copy", () => {
  it("复制成功后短暂置 copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { result } = renderHook(() => useTreeContextMenu());

    await act(async () => result.current.copy("notes/a.md"));

    expect(writeText).toHaveBeenCalledWith("notes/a.md");
    expect(result.current.copied).toBe(true);
  });

  it("无 clipboard API 时不展示「已复制」", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    const { result } = renderHook(() => useTreeContextMenu());

    await act(async () => result.current.copy("notes/a.md"));

    expect(result.current.copied).toBe(false);
  });

  it("clipboard 写入被拒绝时不展示「已复制」", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { result } = renderHook(() => useTreeContextMenu());

    await act(async () => result.current.copy("notes/a.md"));

    expect(result.current.copied).toBe(false);
  });
});
