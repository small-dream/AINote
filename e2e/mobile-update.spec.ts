import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36";
const RELEASE_API = "https://api.github.com/**";
const RELEASE_URL = "https://github.com/small-dream/AINote/releases/tag/v0.25.0";

function baseState(): E2eState {
  return {
    repoPath: "/mock-repo",
    appVersion: "0.24.12",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
  };
}

function fulfillRelease(version: string) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tag_name: version, html_url: RELEASE_URL, body: "## 更新内容\n\n- 修复若干问题" }),
  };
}

test.describe("Android 应用内更新提示（E1-T5）", () => {
  test.use({ viewport: { width: 430, height: 900 }, userAgent: ANDROID_UA });

  test("发现新版本时提示并可跳转 Release 页面", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    const banner = page.getByRole("status").filter({ hasText: "发现新版本 0.25.0" });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: "前往 Release 页面下载" }).click();
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "open_external").length)
      .toBe(1);
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "open_external")[0]?.args)
      .toEqual({ url: RELEASE_URL });
  });

  test("忽略后不再提示该版本", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    const banner = page.getByRole("status").filter({ hasText: "发现新版本 0.25.0" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "忽略此版本" }).click();
    await expect(banner).toBeHidden();
  });

  test("已是最新版本时只在设置页说明，不打扰使用", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.24.12")));
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "软件更新" }).click();
    await expect(page.getByText("当前已是最新版本。")).toBeVisible();
    await expect(page.getByText("v0.24.12")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "发现新版本" })).toHaveCount(0);
  });

  test("接口不可用时静默降级，不打断使用", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.abort());
    await openWorkspace(page, baseState());

    await expect(page.getByText("全部笔记").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "发现新版本" })).toHaveCount(0);

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "软件更新" }).click();
    await expect(page.getByText("无法检查更新，请检查网络后重试")).toBeVisible();
  });
});

test.describe("桌面端不受影响（E1-T5）", () => {
  test("桌面壳不显示移动更新提示", async ({ page }) => {
    await page.route(RELEASE_API, (route) => route.fulfill(fulfillRelease("v0.25.0")));
    await openWorkspace(page, baseState());

    await expect(page.getByText("全部笔记").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "发现新版本" })).toHaveCount(0);
  });
});
