import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateApi } from "./update.api";

const updaterMock = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn() }));
const supportMock = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => updaterMock);
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("./support.api", () => ({ supportApi: supportMock }));

const UPDATE_WITHOUT_NOTES = {
  version: "0.23.2",
  body: "",
  date: null,
  currentVersion: "0.23.1",
  close: vi.fn(),
};

function resetMocks(): void {
  updaterMock.check.mockReset();
  supportMock.log.mockReset();
  supportMock.log.mockResolvedValue(undefined);
}

describe("updateApi 检查更新", () => {
  beforeEach(resetMocks);
  afterEach(() => vi.unstubAllGlobals());

  it("updater 缺少发布说明时回退读取 GitHub Release", async () => {
    updaterMock.check.mockResolvedValue({ ...UPDATE_WITHOUT_NOTES });
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

  it("清单自带更新说明时不再请求 GitHub API", async () => {
    updaterMock.check.mockResolvedValue({
      version: "0.61.0",
      body: "- 修复更新弹窗没有说明",
      date: null,
      currentVersion: "0.60.1",
      close: vi.fn(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({
      body: "- 修复更新弹窗没有说明",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supportMock.log).not.toHaveBeenCalled();
  });
});

describe("updateApi 发布说明兜底失败", () => {
  beforeEach(resetMocks);
  afterEach(() => vi.unstubAllGlobals());

  it("GitHub 发布说明不可用时保留 updater 返回值", async () => {
    updaterMock.check.mockResolvedValue({ ...UPDATE_WITHOUT_NOTES });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({ body: null });
  });

  it("回退失败时写告警日志，不再静默吞掉", async () => {
    updaterMock.check.mockResolvedValue({ ...UPDATE_WITHOUT_NOTES });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({ body: null });
    expect(supportMock.log).toHaveBeenCalledWith(
      "warn",
      "更新说明获取失败 version=0.23.2",
      "UPDATE_RELEASE_NOTES_UNAVAILABLE",
    );
  });

  it("日志上报失败也不影响检查结果", async () => {
    updaterMock.check.mockResolvedValue({ ...UPDATE_WITHOUT_NOTES });
    supportMock.log.mockRejectedValue(new Error("ipc down"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(updateApi.checkForUpdate()).resolves.toMatchObject({ body: null });
  });
});
