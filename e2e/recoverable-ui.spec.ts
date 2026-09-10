import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "daily/a.md", content: "# 冲突笔记\n\n正文" }] };
}

test.describe("可恢复 UI 收口（E3-T5）", () => {
  test("同步失败：展示阶段、原因、建议与重试 / 导出诊断包入口", async ({ page }) => {
    const state = baseState();
    state.syncFailure = { code: "SYNC_4002", kind: "network", message: "连接超时", retriable: true };
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "立即同步" }).click();

    const banner = page.getByRole("alert").filter({ hasText: "同步失败 · 拉取 / 推送阶段" });
    await expect(banner).toContainText("同步失败 · 拉取 / 推送阶段");
    await expect(banner).toContainText("连接超时");
    await expect(banner).toContainText("网络连接异常，请检查网络后重试");
    await expect(banner.getByRole("button", { name: "重试同步" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "导出诊断包" })).toBeVisible();
    await expect(page.getByRole("button", { name: "同步失败" })).toBeVisible();

    const before = (await calls(page)).filter((call) => call.cmd === "sync_now").length;
    await banner.getByRole("button", { name: "重试同步" }).click();
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "sync_now").length)
      .toBeGreaterThan(before);
  });

  test("冲突兜底：三栏合并里可导出冲突文件", async ({ page }) => {
    const state = baseState();
    state.conflicted = true;
    state.conflicts = [{ path: "daily/a.md", local: "本地版本", remote: "远端版本" }];
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "解决同步冲突" }).click();
    const dialog = page.getByRole("dialog", { name: "daily/a.md" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "1 本地版本" })).toBeVisible();

    await dialog.getByRole("button", { name: "导出冲突文件" }).click();
    await expect(dialog.getByRole("button", { name: "已导出冲突文件" })).toBeVisible();
  });

  test("删除确认：说明进入回收站并提供恢复入口", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "daily", exact: true }).click();
    await page.getByRole("button", { name: "a", exact: true }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "删除笔记" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("删除后可在回收站中恢复。");
    await expect(dialog).toContainText("恢复入口：侧边栏「回收站」");
    await dialog.getByRole("button", { name: "打开回收站" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("回收站是空的")).toBeVisible();
  });
});

test.describe("同步自动重试（E4-T2）", () => {
  test("拉取自动重试：显示重试中（n/m）并可取消", async ({ page }) => {
    const state = baseState();
    state.syncRetry = { retry: 1, maxRetries: 3, delayMs: 1500 };
    await openWorkspace(page, state);

    const retrying = page.getByRole("status").filter({ hasText: "重试中（1/3）" });
    await expect(retrying).toBeVisible();
    await expect(retrying).toContainText("2 秒后自动重试");

    await page.getByRole("button", { name: "取消重试" }).click();
    await expect.poll(async () => (await calls(page)).some((call) => call.cmd === "cancel_sync_retry")).toBe(true);
    await expect(page.getByRole("button", { name: "取消重试" })).toBeHidden();
  });
});

test.describe("同步失败定位（E4-T4）", () => {
  test("后端定位到拉取阶段并列出可处理文件", async ({ page }) => {
    const state = baseState();
    state.syncFailure = {
      code: "SYNC_4001",
      kind: "conflict",
      message: "存在未完成的合并",
      retriable: false,
      stage: "pull",
      hint: "resolveConflicts",
      files: ["daily/a.md", "daily/b.md"],
    };
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "立即同步" }).click();

    const banner = page.getByRole("alert").filter({ hasText: "同步失败 · 拉取阶段" });
    await expect(banner).toContainText("存在未完成的合并");
    await expect(banner).toContainText("存在未解决的合并冲突，请先解决冲突再同步");
    await expect(banner).toContainText("失败文件（2）");
    await expect(banner).toContainText("daily/a.md");
    await expect(banner).toContainText("daily/b.md");
  });
});

test.describe("可恢复 UI 收口（E3-T5）/ 移动单栏壳", () => {
  test.use({ viewport: { width: 430, height: 900 } });

  test("窄屏同样可定位失败阶段与文件", async ({ page }) => {
    const state = baseState();
    state.syncFailure = {
      code: "GIT_4001",
      kind: "io",
      message: "commit failed",
      retriable: true,
      stage: "commit",
      files: ["daily/a.md"],
    };
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "立即同步" }).click();

    const banner = page.getByRole("alert").filter({ hasText: "同步失败 · 本地提交阶段" });
    await expect(banner).toContainText("commit failed");
    await expect(banner).toContainText("失败文件（1）");
    await expect(banner).toContainText("daily/a.md");
  });

  test("窄屏移动壳同样展示失败阶段与重试入口", async ({ page }) => {
    const state = baseState();
    state.syncFailure = { code: "SYNC_4002", kind: "network", message: "连接超时", retriable: true };
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "立即同步" }).click();

    const banner = page.getByRole("alert").filter({ hasText: "同步失败 · 拉取 / 推送阶段" });
    await expect(banner).toContainText("同步失败 · 拉取 / 推送阶段");
    await expect(banner).toContainText("连接超时");
    await expect(banner).toContainText("网络连接异常，请检查网络后重试");
    await expect(banner.getByRole("button", { name: "重试同步" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "导出诊断包" })).toBeVisible();

    const before = (await calls(page)).filter((call) => call.cmd === "sync_now").length;
    await banner.getByRole("button", { name: "重试同步" }).click();
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "sync_now").length)
      .toBeGreaterThan(before);
  });
});
