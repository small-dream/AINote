import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateApiMock = vi.hoisted(() => ({
  getCurrentVersion: vi.fn(),
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

vi.mock("@/api", () => ({ updateApi: updateApiMock, recordMetric: vi.fn() }));

import { useUiStore } from "@/stores/ui.store";
import { INITIAL_DESKTOP_UPDATE_STATE, useDesktopUpdateStore } from "../stores/desktop-update.store";
import { DesktopUpdateDialog } from "./DesktopUpdateDialog";

const UPDATE_INFO = {
  version: "0.15.0",
  body: "## 更新内容\n\n- 修复同步冲突",
  date: "2026-08-01T00:00:00.000Z",
  currentVersion: "0.14.2",
};

function resetStore() {
  useDesktopUpdateStore.setState({
    ...INITIAL_DESKTOP_UPDATE_STATE,
    dismissedVersion: null,
    snoozedVersion: null,
  });
  globalThis.localStorage?.clear();
}

beforeEach(() => {
  vi.resetAllMocks();
  useUiStore.setState({ locale: "zh-CN" });
  resetStore();
  updateApiMock.checkForUpdate.mockResolvedValue(UPDATE_INFO);
});

afterEach(() => {
  vi.useRealTimers();
});

/** 用假定时器推进到自动检查触发并刷新微任务。 */
async function openWithAutoCheck() {
  vi.useFakeTimers();
  render(<DesktopUpdateDialog />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });
}

async function flushAsync() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("DesktopUpdateDialog 主动提示", () => {
  it("启动自动检查发现新版本时弹出升级提示", async () => {
    await openWithAutoCheck();

    expect(screen.getByText("发现新版本 0.15.0")).toBeTruthy();
    expect(screen.getByText("当前版本 v0.14.2 → 新版本 v0.15.0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "更新到 0.15.0" })).toBeTruthy();
    expect(screen.getByText("修复同步冲突")).toBeTruthy();
  });

  it("没有新版本时不弹出", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(null);
    await openWithAutoCheck();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("「稍后再说」本次会话关闭，同一版本不再打扰", async () => {
    await openWithAutoCheck();

    fireEvent.click(screen.getByRole("button", { name: "稍后再说" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // 模拟再次检查把状态置回待安装，也不应重新弹出
    act(() => {
      useDesktopUpdateStore.getState().report({ phase: "readyToInstall", info: UPDATE_INFO });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("「忽略此版本」持久化且不再弹出", async () => {
    await openWithAutoCheck();

    fireEvent.click(screen.getByRole("button", { name: "忽略此版本" }));

    expect(globalThis.localStorage?.getItem("ainote.desktop-update.dismissed")).toBe("0.15.0");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("已忽略的版本不再弹出", async () => {
    globalThis.localStorage?.setItem("ainote.desktop-update.dismissed", "0.15.0");
    useDesktopUpdateStore.setState({ dismissedVersion: "0.15.0" });

    await openWithAutoCheck();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("下载中展示进度并禁止关闭", async () => {
    updateApiMock.installUpdate.mockImplementation(async (onEvent?: (event: { phase: "downloading"; progress: { receivedBytes: number; totalBytes: number; percent: number } }) => void) => {
      onEvent?.({ phase: "downloading", progress: { receivedBytes: 524288, totalBytes: 1048576, percent: 50 } });
    });
    await openWithAutoCheck();

    fireEvent.click(screen.getByRole("button", { name: "更新到 0.15.0" }));
    await flushAsync();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("正在下载并安装更新，完成后 AINote 将自动重启。")).toBeTruthy();
  });

  it("安装失败后展示错误并支持重试", async () => {
    updateApiMock.installUpdate.mockRejectedValueOnce(new Error("network"));
    await openWithAutoCheck();

    fireEvent.click(screen.getByRole("button", { name: "更新到 0.15.0" }));
    await flushAsync();
    expect(screen.getByText("安装更新失败")).toBeTruthy();

    updateApiMock.installUpdate.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await flushAsync();
    expect(screen.getByText("正在下载并安装更新，完成后 AINote 将自动重启。")).toBeTruthy();
  });
});
