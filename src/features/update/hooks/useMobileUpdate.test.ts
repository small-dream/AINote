import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  android: true,
  offline: false,
  version: "0.25.0",
  current: "0.24.12",
  downloadResult: null as { path: string } | null,
  downloadFails: false,
  installNeedsPermission: false,
  installFails: false,
}));

const api = vi.hoisted(() => ({
  downloadUpdate: vi.fn(),
  cancelUpdateDownload: vi.fn(),
  installApk: vi.fn(),
}));

vi.mock("@/platform/runtime", () => ({ isAndroidApp: () => state.android }));
vi.mock("@/features/support/error-report", () => ({ reportFrontendError: vi.fn() }));
vi.mock("@/api", () => ({
  recordMetric: vi.fn(),
  mobileUpdateApi: api,
  releaseApi: {
    fetchLatestRelease: () =>
      state.offline
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({
            version: state.version,
            htmlUrl: `https://github.com/small-dream/AINote/releases/tag/v${state.version}`,
            body: null,
            currentVersion: state.current,
            apkUrl: "https://github.com/small-dream/AINote/releases/download/v0.25.0/AINote-v0.25.0-android-arm64.apk",
            apkSha256Url: "https://github.com/small-dream/AINote/releases/download/v0.25.0/AINote-v0.25.0-android-arm64.apk.sha256",
          }),
  },
}));

import { useMobileUpdate } from "./useMobileUpdate";
import { useMobileUpdateStore } from "../stores/mobile-update.store";

function resetStore() {
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

beforeEach(() => {
  state.android = true;
  state.offline = false;
  state.version = "0.25.0";
  state.current = "0.24.12";
  state.downloadResult = null;
  state.downloadFails = false;
  state.installNeedsPermission = false;
  state.installFails = false;
  api.downloadUpdate.mockReset().mockImplementation(async (_args, onProgress) => {
    onProgress?.({ receivedBytes: 50, totalBytes: 100, percent: 50 });
    if (state.downloadFails) throw new Error("network");
    return state.downloadResult;
  });
  api.cancelUpdateDownload.mockReset().mockResolvedValue(undefined);
  api.installApk.mockReset().mockImplementation(async () => {
    if (state.installFails) throw new Error("bridge");
    return { needsPermission: state.installNeedsPermission };
  });
  resetStore();
});

describe("useMobileUpdate 检查", () => {
  it("发现新版本时进入 available 并带上 Release 信息", async () => {
    const { result } = renderHook(() => useMobileUpdate());
    await waitFor(() => expect(result.current.phase).toBe("available"));
    expect(result.current.release?.version).toBe("0.25.0");
    expect(result.current.currentVersion).toBe("0.24.12");
  });

  it("已是最新版本时进入 upToDate 且不保留 Release", async () => {
    state.version = "0.24.12";
    const { result } = renderHook(() => useMobileUpdate());
    await waitFor(() => expect(result.current.phase).toBe("upToDate"));
    expect(result.current.release).toBeNull();
  });

  it("远端版本低于当前版本时不提示（降级保护）", async () => {
    state.version = "0.24.11";
    const { result } = renderHook(() => useMobileUpdate());
    await waitFor(() => expect(result.current.phase).toBe("upToDate"));
    expect(result.current.release).toBeNull();
  });

  it("接口失败时静默降级为 failed", async () => {
    state.offline = true;
    const { result } = renderHook(() => useMobileUpdate());
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.release).toBeNull();
  });

  it("非 Android 环境不自动检查", async () => {
    state.android = false;
    const { result } = renderHook(() => useMobileUpdate());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.phase).toBe("idle");
  });

  it("失败后可手动重新检查", async () => {
    state.offline = true;
    const { result } = renderHook(() => useMobileUpdate());
    await waitFor(() => expect(result.current.phase).toBe("failed"));

    state.offline = false;
    await result.current.check();
    await waitFor(() => expect(result.current.phase).toBe("available"));
  });
});

async function renderAvailable() {
  const rendered = renderHook(() => useMobileUpdate());
  await waitFor(() => expect(rendered.result.current.phase).toBe("available"));
  return rendered;
}

describe("useMobileUpdate 下载与安装", () => {
  it("下载成功后自动调起安装器", async () => {
    state.downloadResult = { path: "/cache/updates/ainote-0.25.0.apk" };
    const { result } = await renderAvailable();

    await result.current.download();

    expect(api.downloadUpdate).toHaveBeenCalledWith(
      {
        url: expect.stringContaining("-android-arm64.apk"),
        sha256Url: expect.stringContaining(".apk.sha256"),
        version: "0.25.0",
      },
      expect.any(Function),
    );
    await waitFor(() => expect(result.current.phase).toBe("installing"));
    expect(api.installApk).toHaveBeenCalledWith("/cache/updates/ainote-0.25.0.apk");
    expect(result.current.apkPath).toBe("/cache/updates/ainote-0.25.0.apk");
  });

  it("缺安装权限时标记 installNeedsPermission", async () => {
    state.downloadResult = { path: "/cache/updates/ainote-0.25.0.apk" };
    state.installNeedsPermission = true;
    const { result } = await renderAvailable();

    await result.current.download();
    await waitFor(() => expect(result.current.installNeedsPermission).toBe(true));
  });

  it("用户取消下载时回到 available", async () => {
    state.downloadResult = null;
    const { result } = await renderAvailable();

    await result.current.download();
    await waitFor(() => expect(result.current.phase).toBe("available"));
    expect(api.installApk).not.toHaveBeenCalled();
  });

  it("下载失败进入 downloadFailed，可重试", async () => {
    state.downloadFails = true;
    const { result } = await renderAvailable();

    await result.current.download();
    await waitFor(() => expect(result.current.phase).toBe("downloadFailed"));

    state.downloadFails = false;
    state.downloadResult = { path: "/cache/updates/ainote-0.25.0.apk" };
    await result.current.download();
    await waitFor(() => expect(result.current.phase).toBe("installing"));
  });
});

describe("useMobileUpdate 安装失败与重试", () => {
  it("下载成功但调起安装器失败时进入 installFailed，保留安装包可直接重试", async () => {
    state.downloadResult = { path: "/cache/updates/ainote-0.25.0.apk" };
    state.installFails = true;
    const { result } = await renderAvailable();

    await result.current.download();
    await waitFor(() => expect(result.current.phase).toBe("installFailed"));
    expect(result.current.apkPath).toBe("/cache/updates/ainote-0.25.0.apk");

    state.installFails = false;
    await result.current.reopenInstaller();
    await waitFor(() => expect(result.current.phase).toBe("installing"));
    expect(api.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it("reopenInstaller 复用已下载的 APK 路径", async () => {
    state.downloadResult = { path: "/cache/updates/ainote-0.25.0.apk" };
    const { result } = await renderAvailable();
    await result.current.download();
    await waitFor(() => expect(result.current.phase).toBe("installing"));

    api.installApk.mockClear();
    await result.current.reopenInstaller();
    expect(api.installApk).toHaveBeenCalledWith("/cache/updates/ainote-0.25.0.apk");
  });
});
