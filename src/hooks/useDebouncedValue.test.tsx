import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("初始值立即返回，不等待防抖窗口", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 250));
    expect(result.current).toBe("a");
  });

  it("窗口内不更新，到期后生效", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: "a" } });

    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(249); });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("b");
  });

  it("窗口内连续变化只保留最新值", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: "a" } });

    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: "c" });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: "d" });
    act(() => { vi.advanceTimersByTime(249); });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("d");
  });

  it("卸载时清理计时器，不再触发更新", () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    unmount();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current).toBe("a");
  });
});
