import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  openExternal: vi.fn(),
  fetchLatestRelease: vi.fn(),
  downloadUpdate: vi.fn(),
  cancelUpdateDownload: vi.fn(),
  installApk: vi.fn(),
}));

vi.mock("@/platform/runtime", () => ({ isAndroidApp: () => true }));
vi.mock("@/features/support/error-report", () => ({ reportFrontendError: vi.fn() }));
vi.mock("@/api", () => ({
  openExternal: api.openExternal,
  recordMetric: vi.fn(),
  releaseApi: { fetchLatestRelease: api.fetchLatestRelease },
  mobileUpdateApi: {
    downloadUpdate: api.downloadUpdate,
    cancelUpdateDownload: api.cancelUpdateDownload,
    installApk: api.installApk,
  },
}));

import { useMobileUpdateStore } from "../stores/mobile-update.store";
import { MobileUpdateDialog } from "./MobileUpdateDialog";

const APK_URL = "https://github.com/small-dream/AINote/releases/download/v0.25.0/AINote-v0.25.0-android-arm64.apk";
const RELEASE = {
  version: "0.25.0",
  htmlUrl: "https://github.com/small-dream/AINote/releases/tag/v0.25.0",
  body: null,
  currentVersion: "0.24.12",
  apkUrl: APK_URL,
  apkSha256Url: `${APK_URL}.sha256`,
};

function resetFakes() {
  for (const mock of Object.values(api)) mock.mockReset();
  api.fetchLatestRelease.mockResolvedValue(RELEASE);
  api.downloadUpdate.mockImplementation(async (_args, onProgress) => {
    onProgress?.({ receivedBytes: 524288, totalBytes: 1048576, percent: 50 });
    return { path: "/cache/updates/ainote-0.25.0.apk" };
  });
  api.cancelUpdateDownload.mockResolvedValue(undefined);
  api.installApk.mockResolvedValue({ needsPermission: false });
  useMobileUpdateStore.setState({
    phase: "idle",
    currentVersion: null,
    release: null,
    dismissedVersion: null,
    progress: null,
    apkPath: null,
    installNeedsPermission: false,
  });
}

beforeEach(resetFakes);

describe("MobileUpdateDialog", () => {
  it("无新版本时不渲染", async () => {
    api.fetchLatestRelease.mockResolvedValue({ ...RELEASE, version: "0.24.12" });
    render(<MobileUpdateDialog />);
    await waitFor(() => expect(useMobileUpdateStore.getState().phase).toBe("upToDate"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("发现新版本时弹出版本号与「立即更新」", async () => {
    render(<MobileUpdateDialog />);
    const dialog = await screen.findByRole("dialog", { name: /发现新版本 0\.25\.0/ });
    expect(dialog.textContent).toContain("调起系统安装器");
    expect(screen.getByRole("button", { name: "立即更新" })).toBeTruthy();
  });

  it("Release 缺少 APK 资产时降级为跳转下载页", async () => {
    api.fetchLatestRelease.mockResolvedValue({ ...RELEASE, apkUrl: null, apkSha256Url: null });
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "前往 Release 页面下载" }));

    expect(api.openExternal).toHaveBeenCalledWith(RELEASE.htmlUrl);
    expect(api.downloadUpdate).not.toHaveBeenCalled();
  });

  it("忽略后不再提示该版本", async () => {
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "忽略此版本" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(useMobileUpdateStore.getState().dismissedVersion).toBe("0.25.0");
  });

  it("稍后再说只关闭本次会话，不持久化忽略", async () => {
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "稍后再说" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(useMobileUpdateStore.getState().dismissedVersion).toBeNull();
  });

  it("检查失败时不显示任何提示", async () => {
    api.fetchLatestRelease.mockRejectedValue(new Error("offline"));
    render(<MobileUpdateDialog />);
    await waitFor(() => expect(useMobileUpdateStore.getState().phase).toBe("failed"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("MobileUpdateDialog 下载与安装", () => {
  it("立即更新：应用内下载并自动调起安装器", async () => {
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "立即更新" }));

    expect(await screen.findByRole("progressbar")).toBeTruthy();
    await waitFor(() => expect(api.installApk).toHaveBeenCalledWith("/cache/updates/ainote-0.25.0.apk"));
    expect(await screen.findByText(/安装器已打开/)).toBeTruthy();
  });

  it("下载中可取消：通知后端取消", async () => {
    api.downloadUpdate.mockImplementation(
      () => new Promise(() => {}), // 永不返回，停留在下载中
    );
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "立即更新" }));
    fireEvent.click(await screen.findByRole("button", { name: "取消下载" }));

    expect(api.cancelUpdateDownload).toHaveBeenCalled();
  });

  it("下载失败时提示并可重试", async () => {
    api.downloadUpdate.mockRejectedValueOnce(new Error("network"));
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "立即更新" }));

    expect((await screen.findByRole("alert")).textContent).toContain("下载更新失败");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(api.installApk).toHaveBeenCalled());
  });

  it("缺安装权限时展示授权引导", async () => {
    api.installApk.mockResolvedValue({ needsPermission: true });
    render(<MobileUpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "立即更新" }));

    expect(await screen.findByText(/请先在系统设置中允许安装应用/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新打开安装器" }));
    await waitFor(() => expect(api.installApk).toHaveBeenCalledTimes(2));
  });
});
