import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateApi } from "./update.api";

const updaterMock = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn() }));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => updaterMock);
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

describe("updateApi 检查更新", () => {
  beforeEach(() => {
    updaterMock.check.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updater 缺少发布说明时回退读取 GitHub Release", async () => {
    updaterMock.check.mockResolvedValue({
      version: "0.23.2",
      body: "",
      date: "2026-09-05T00:00:00.000Z",
      currentVersion: "0.23.1",
      close: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      body: "## 更新内容\n\n- 修复更新进度显示",
    }), { status: 200 })));

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({
      body: "## 更新内容\n\n- 修复更新进度显示",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/small-dream/AINote/releases/tags/v0.23.2",
      { headers: { Accept: "application/vnd.github+json" } },
    );
  });

  it("GitHub 发布说明不可用时保留 updater 返回值", async () => {
    updaterMock.check.mockResolvedValue({
      version: "0.23.2",
      body: null,
      date: null,
      currentVersion: "0.23.1",
      close: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({ body: null });
  });
});
