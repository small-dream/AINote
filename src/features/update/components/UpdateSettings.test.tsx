import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import type { UpdateInstallEvent, UpdateProgress } from "@/api/update.api";
import { UpdateSettings } from "./UpdateSettings";

const updateApiMock = vi.hoisted(() => ({
  getCurrentVersion: vi.fn(),
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

vi.mock("@/api", () => ({ updateApi: updateApiMock }));

const updateInfo = {
  version: "0.15.0",
  body: "修复同步冲突\n提升启动速度",
  date: "2026-08-01T00:00:00.000Z",
  currentVersion: "0.14.2",
};

describe("UpdateSettings 检查更新", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useUiStore.setState({ locale: "zh-CN" });
    updateApiMock.getCurrentVersion.mockResolvedValue("0.14.2");
  });

  it("展示当前版本并检查更新", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(updateInfo);
    render(<UpdateSettings />);
    expect(await screen.findByText("v0.14.2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(await screen.findByText("发现新版本 0.15.0")).toBeTruthy();
    expect(screen.getByText("更新到 0.15.0")).toBeTruthy();
    expect(screen.getByText(/修复同步冲突/)).toBeTruthy();
  });

  it("没有新版本时提供再次检查入口", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(null);
    render(<UpdateSettings />);
    await waitFor(() => expect(screen.getByRole("button", { name: "检查更新" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(await screen.findByText("当前已是最新版本。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "检查更新" })).toBeTruthy();
  });
});

describe("UpdateSettings 安装更新", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useUiStore.setState({ locale: "zh-CN" });
    updateApiMock.getCurrentVersion.mockResolvedValue("0.14.2");
  });

  it("下载中显示确定进度并禁用操作", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(updateInfo);
    updateApiMock.installUpdate.mockImplementation(async (onEvent?: (event: UpdateInstallEvent) => void) => {
      const progress: UpdateProgress = { receivedBytes: 524288, totalBytes: 1048576, percent: 50 };
      onEvent?.({ phase: "downloading", progress });
    });
    render(<UpdateSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "检查更新" }));
    await screen.findByText("发现新版本 0.15.0");
    fireEvent.click(screen.getByRole("button", { name: "更新到 0.15.0" }));

    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50"));
    expect(screen.getByText(/50% · 512 KB \/ 1.0 MB/)).toBeTruthy();
  });

  it("下载未知大小时使用扫动占位而非固定进度", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(updateInfo);
    updateApiMock.installUpdate.mockImplementation(async (onEvent?: (event: UpdateInstallEvent) => void) => {
      onEvent?.({ phase: "downloading", progress: { receivedBytes: 0, totalBytes: null, percent: null } });
    });
    render(<UpdateSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "检查更新" }));
    await screen.findByText("发现新版本 0.15.0");
    fireEvent.click(screen.getByRole("button", { name: "更新到 0.15.0" }));

    const progressbar = await screen.findByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBeNull();
    expect(progressbar.querySelector(".update-progress-indeterminate")).toBeTruthy();
    expect(screen.getByText("已下载 0 B")).toBeTruthy();
  });

  it("下载失败后允许重试", async () => {
    updateApiMock.checkForUpdate.mockResolvedValue(updateInfo);
    updateApiMock.installUpdate.mockRejectedValue(new Error("network"));
    render(<UpdateSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "检查更新" }));
    fireEvent.click(await screen.findByRole("button", { name: "更新到 0.15.0" }));

    expect(await screen.findByText("安装更新失败")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});
