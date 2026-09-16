import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openWorkspace } from "./helpers";

function baseState(): E2eState {
  return {
    repoPath: "/mock-repo",
    appVersion: "0.39.0",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
  };
}

async function openVaultSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "加密笔记" }).click();
  await expect(page.getByText("尚未启用加密笔记")).toBeVisible();
}

/** 建库（口令为 e2e mock 认可的固定值）并等待进入解锁态。 */
async function enableVault(page: Page): Promise<void> {
  await page.getByLabel("仓库口令").fill("correct horse battery");
  await page.getByLabel("再次输入口令").fill("correct horse battery");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "启用加密" }).click();
  await expect(page.getByText("加密笔记已解锁")).toBeVisible();
}

test.describe("加密笔记（E2）", () => {
  test("建库后立即进入解锁态，可一键锁定", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openVaultSettings(page);
    await enableVault(page);

    await page.getByRole("button", { name: "立即锁定" }).click();
    await expect(page.getByText("已锁定")).toBeVisible();
    await expect(page.getByRole("button", { name: "解锁" })).toBeVisible();
  });

  test("口令不达标时禁用提交，口令错误时给出可读提示且保持锁定", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openVaultSettings(page);

    // 口令过短：给出原因并禁用提交
    await page.getByLabel("仓库口令").fill("short");
    await expect(page.getByText("口令至少需要 12 个字符")).toBeVisible();
    await expect(page.getByRole("button", { name: "启用加密" })).toBeDisabled();

    await enableVault(page);
    await page.getByRole("button", { name: "立即锁定" }).click();

    // 错误口令：解锁失败但保持锁定，用户可以重试
    await page.getByLabel("仓库口令").fill("wrong passphrase here");
    await page.getByRole("button", { name: "解锁" }).click();
    await expect(page.getByText("口令错误，或仓库密钥文件已损坏。")).toBeVisible();
    await expect(page.getByText("已锁定")).toBeVisible();
  });

  test("边界说明在建库前就可见：不记住口令、无恢复码、不支持 AI 与版本历史", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openVaultSettings(page);

    await expect(page.getByText(/桌面端不提供「记住口令」/)).toBeVisible();
    await expect(page.getByText(/不会生成恢复码/)).toBeVisible();
    await expect(page.getByText(/也不提供版本历史/)).toBeVisible();
  });
});
