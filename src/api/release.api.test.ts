import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: () => Promise.resolve("0.24.12") }));

import { releaseApi } from "./release.api";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const APK_NAME = "AINote-v0.25.0-android-arm64.apk";
const APK_URL = `https://github.com/small-dream/AINote/releases/download/v0.25.0/${APK_NAME}`;

function fulfill(payload: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function releasePayload(assets: unknown) {
  return {
    tag_name: "v0.25.0",
    html_url: "https://github.com/small-dream/AINote/releases/tag/v0.25.0",
    body: "notes",
    assets,
  };
}

beforeEach(() => fetchMock.mockReset());

describe("releaseApi.fetchLatestRelease", () => {
  it("解析 APK 资产与其 sha256 校验和地址", async () => {
    fulfill(
      releasePayload([
        { name: APK_NAME, browser_download_url: APK_URL },
        { name: `${APK_NAME}.sha256`, browser_download_url: `${APK_URL}.sha256` },
        { name: "AINote-v0.25.0.aab", browser_download_url: "https://example.com/aab" },
      ]),
    );

    const release = await releaseApi.fetchLatestRelease();
    expect(release.version).toBe("0.25.0");
    expect(release.currentVersion).toBe("0.24.12");
    expect(release.apkUrl).toBe(APK_URL);
    expect(release.apkSha256Url).toBe(`${APK_URL}.sha256`);
  });

  it("只有 APK 没有 sha256 时 apkSha256Url 为 null（前端据此降级）", async () => {
    fulfill(releasePayload([{ name: APK_NAME, browser_download_url: APK_URL }]));
    const release = await releaseApi.fetchLatestRelease();
    expect(release.apkUrl).toBe(APK_URL);
    expect(release.apkSha256Url).toBeNull();
  });

  it("旧版本 Release 没有 APK 资产时两者均为 null", async () => {
    fulfill(releasePayload([{ name: "AINote-v0.25.0.aab", browser_download_url: "https://example.com/aab" }]));
    const release = await releaseApi.fetchLatestRelease();
    expect(release.apkUrl).toBeNull();
    expect(release.apkSha256Url).toBeNull();
  });

  it("assets 结构异常时不抛错，按无资产处理", async () => {
    fulfill(releasePayload("not-an-array"));
    const release = await releaseApi.fetchLatestRelease();
    expect(release.apkUrl).toBeNull();

    fulfill(releasePayload([{ name: APK_NAME }, { browser_download_url: APK_URL }, null]));
    const malformed = await releaseApi.fetchLatestRelease();
    expect(malformed.apkUrl).toBeNull();
  });

  it("tag 归一化去掉 v 前缀，html_url 缺失时兜底拼接", async () => {
    fulfill({ tag_name: "v0.25.0", assets: [] });
    const release = await releaseApi.fetchLatestRelease();
    expect(release.version).toBe("0.25.0");
    expect(release.htmlUrl).toBe("https://github.com/small-dream/AINote/releases/tag/v0.25.0");
  });

  it("接口非 200 时抛错，由调用方静默降级", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 403 }));
    await expect(releaseApi.fetchLatestRelease()).rejects.toThrow("RELEASE_FETCH_FAILED");
  });
});
