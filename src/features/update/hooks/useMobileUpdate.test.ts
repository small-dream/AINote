import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  android: true,
  offline: false,
  version: "0.25.0",
  current: "0.24.12",
}));

vi.mock("@/platform/runtime", () => ({ isAndroidApp: () => state.android }));
vi.mock("@/api", () => ({
  releaseApi: {
    fetchLatestRelease: () =>
      state.offline
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({
            version: state.version,
            htmlUrl: `https://github.com/small-dream/AINote/releases/tag/v${state.version}`,
            body: null,
            currentVersion: state.current,
          }),
  },
}));

import { useMobileUpdate } from "./useMobileUpdate";
import { useMobileUpdateStore } from "../stores/mobile-update.store";

beforeEach(() => {
  state.android = true;
  state.offline = false;
  state.version = "0.25.0";
  state.current = "0.24.12";
  useMobileUpdateStore.setState({ phase: "idle", currentVersion: null, release: null, dismissedVersion: null });
});

describe("useMobileUpdate", () => {
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
