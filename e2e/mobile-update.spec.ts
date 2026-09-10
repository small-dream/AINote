import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36";
const RELEASE_API = "https://api.github.com/**";
const RELEASE_URL = "https://github.com/small-dream/AINote/releases/tag/v0.25.0";
const APK_NAME = "AINote-v0.25.0-android-arm64.apk";
const APK_URL = `https://github.com/small-dream/AINote/releases/download/v0.25.0/${APK_NAME}`;

function baseState(): E2eState {
  return {
    repoPath: "/mock-repo",
    appVersion: "0.24.12",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
  };
}

/** 模拟 GitHub Release；withAssets=false 模拟没有 APK 资产的旧版本（降级路径）。 */
function fulfillRelease(version: string, withAssets = true) {
  const assets = withAssets
    ? [
        { name: APK_NAME, browser_download_url: APK_URL },
        { name: `${APK_NAME}.sha256`, browser_download_url: `${APK_URL}.sha256` },
      ]
    : [];
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tag_name: version, html_url: RELEASE_URL, body: "## 更新内容", assets }),
  };
}

test.describe("Android 应用内更新弹窗（E1-T5）", () => {
  test.use({ viewport: { width: 430, height: 900 }, userAgent: ANDROID_UA });

  test("发现新版本时应用内下载并调起安装器", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    const dialog = page.getByRole("dialog", { name: "发现新版本 0.25.0" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "立即更新" }).click();

    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "download_update").length)
      .toBe(1);
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "install_update").length)
      .toBe(1);
    await expect(dialog.getByText(/安装器已打开/)).toBeVisible();
  });

  test("Release 缺少 APK 资产时降级为跳转下载页", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0", false)));
    await openWorkspace(page, baseState());

    const dialog = page.getByRole("dialog", { name: "发现新版本 0.25.0" });
    await dialog.getByRole("button", { name: "前往 Release 页面下载" }).click();
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "open_external")[0]?.args)
      .toEqual({ url: RELEASE_URL });
  });

  test("下载失败时提示并可重试", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, { ...baseState(), updateDownloadFails: true });

    const dialog = page.getByRole("dialog", { name: "发现新版本 0.25.0" });
    await dialog.getByRole("button", { name: "立即更新" }).click();
    await expect(dialog.getByRole("alert")).toContainText("下载更新失败");
    await expect(dialog.getByRole("button", { name: "重试" })).toBeVisible();
  });

  test("忽略后不再提示该版本", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    const dialog = page.getByRole("dialog", { name: "发现新版本 0.25.0" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "忽略此版本" }).click();
    await expect(dialog).toBeHidden();
  });

  test("稍后再说关闭弹窗但不忽略该版本", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    const dialog = page.getByRole("dialog", { name: "发现新版本 0.25.0" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "稍后再说" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("全部笔记").first()).toBeVisible();
  });

  test("已是最新版本时只在设置页说明，不打扰使用", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.24.12")));
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "软件更新" }).click();
    await expect(page.getByText("当前已是最新版本。")).toBeVisible();
    await expect(page.getByText("v0.24.12")).toBeVisible();
    await expect(page.getByRole("dialog").filter({ hasText: "发现新版本" })).toHaveCount(0);
  });

  test("接口不可用时静默降级，不打断使用", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.abort());
    await openWorkspace(page, baseState());

    await expect(page.getByText("全部笔记").first()).toBeVisible();
    await expect(page.getByRole("dialog").filter({ hasText: "发现新版本" })).toHaveCount(0);

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "软件更新" }).click();
    await expect(page.getByText("无法检查更新，请检查网络后重试")).toBeVisible();
  });
});

test.describe("桌面端不受影响（E1-T5）", () => {
  test("桌面壳不显示移动更新弹窗", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    await expect(page.getByText("全部笔记").first()).toBeVisible();
    await expect(page.getByRole("dialog").filter({ hasText: "发现新版本" })).toHaveCount(0);
  });
});
