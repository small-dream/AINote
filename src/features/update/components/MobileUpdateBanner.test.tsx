import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ openExternal: vi.fn(), fetchLatestRelease: vi.fn() }));

vi.mock("@/platform/runtime", () => ({ isAndroidApp: () => true }));
vi.mock("@/api", () => ({
  openExternal: api.openExternal,
  recordMetric: vi.fn(),
  releaseApi: { fetchLatestRelease: api.fetchLatestRelease },
}));

import { useMobileUpdateStore } from "../stores/mobile-update.store";
import { MobileUpdateBanner } from "./MobileUpdateBanner";

const RELEASE = {
  version: "0.25.0",
  htmlUrl: "https://github.com/small-dream/AINote/releases/tag/v0.25.0",
  body: null,
  currentVersion: "0.24.12",
};

beforeEach(() => {
  api.openExternal.mockReset();
  api.fetchLatestRelease.mockReset();
  api.fetchLatestRelease.mockResolvedValue(RELEASE);
  useMobileUpdateStore.setState({ phase: "idle", currentVersion: null, release: null, dismissedVersion: null });
});

describe("MobileUpdateBanner", () => {
  it("无新版本时不渲染", async () => {
    api.fetchLatestRelease.mockResolvedValue({ ...RELEASE, version: "0.24.12" });
    const { container } = render(<MobileUpdateBanner />);
    await waitFor(() => expect(useMobileUpdateStore.getState().phase).toBe("upToDate"));
    expect(container.firstChild).toBeNull();
  });

  it("发现新版本时展示版本号与下载入口", async () => {
    render(<MobileUpdateBanner />);
    expect(await screen.findByText(/发现新版本 0\.25\.0/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "前往 Release 页面下载" })).toBeTruthy();
  });

  it("点击下载入口经 openExternal 打开 Release 页", async () => {
    render(<MobileUpdateBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "前往 Release 页面下载" }));
    expect(api.openExternal).toHaveBeenCalledWith(RELEASE.htmlUrl);
  });

  it("忽略后不再提示该版本", async () => {
    render(<MobileUpdateBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "忽略此版本" }));
    await waitFor(() => expect(screen.queryByText(/发现新版本/)).toBeNull());
    expect(useMobileUpdateStore.getState().dismissedVersion).toBe("0.25.0");
  });

  it("检查失败时不显示任何提示", async () => {
    api.fetchLatestRelease.mockRejectedValue(new Error("offline"));
    const { container } = render(<MobileUpdateBanner />);
    await waitFor(() => expect(useMobileUpdateStore.getState().phase).toBe("failed"));
    expect(container.firstChild).toBeNull();
  });
});
