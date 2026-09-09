import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { registerBackHandler, useBackHandler } from "./back-navigation";

const state = vi.hoisted(() => ({
  tauri: true,
  listeners: [] as Array<() => void>,
  off: vi.fn(),
}));

vi.mock("@/api/back-button.api", () => ({
  isTauriRuntime: () => state.tauri,
  onAndroidBackButton: (handler: () => void) => {
    state.listeners.push(handler);
    return Promise.resolve(state.off);
  },
}));

const cleanups: Array<() => void> = [];

function pressBack(): void {
  const handler = state.listeners[0];
  if (!handler) throw new Error("系统返回监听尚未注册");
  handler();
}

beforeEach(() => {
  state.tauri = true;
  state.listeners.length = 0;
  state.off.mockClear();
  Object.defineProperty(window.navigator, "userAgent", {
    value: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36",
    configurable: true,
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((off) => off());
});

describe("back-navigation", () => {
  it("把系统返回派发给最后注册的处理器", async () => {
    const first = vi.fn();
    const second = vi.fn();
    cleanups.push(registerBackHandler(first), registerBackHandler(second));
    await vi.waitFor(() => expect(state.listeners).toHaveLength(1));

    pressBack();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("处理器全部注销后卸载原生监听，恢复系统默认返回", async () => {
    const off = registerBackHandler(vi.fn());
    await vi.waitFor(() => expect(state.listeners).toHaveLength(1));

    off();

    await vi.waitFor(() => expect(state.off).toHaveBeenCalledTimes(1));
  });

  it("非 Tauri 环境不注册原生监听，处理器保持惰性", async () => {
    state.tauri = false;
    const handler = vi.fn();
    const off = registerBackHandler(handler);

    await Promise.resolve();

    expect(state.listeners).toHaveLength(0);
    off();
    expect(handler).not.toHaveBeenCalled();
  });

  it("useBackHandler 随 active 订阅与释放系统返回键", async () => {
    const onBack = vi.fn();
    const { rerender } = renderHook(({ active }) => useBackHandler(active, onBack), {
      initialProps: { active: true },
    });
    await vi.waitFor(() => expect(state.listeners).toHaveLength(1));

    pressBack();
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    await vi.waitFor(() => expect(state.off).toHaveBeenCalledTimes(1));
  });
});
