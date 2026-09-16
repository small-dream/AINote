import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openNote, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return {
    repoPath: "/mock-repo",
    appVersion: "0.40.0",
    notes: [{ path: "a.md", content: "# 笔记\n\n正文" }],
  };
}

async function openVaultSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "加密笔记", exact: true }).click();
  await expect(page.getByText("尚未启用加密笔记")).toBeVisible();
}

/** 打开设置「加密笔记」页（不限定当前库状态）。 */
async function openVaultTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "加密笔记", exact: true }).click();
}

/** 关闭全屏设置视图并等待其退出 DOM。 */
async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(".settings-view")).toBeHidden();
}

/** 通过编辑器「⋯」菜单切换当前笔记的加密态，并等待结果 toast。 */
async function toggleEncryption(page: Page, action: "加密此笔记" | "解密此笔记", toast: string): Promise<void> {
  await page.getByRole("button", { name: "更多" }).click();
  await page.getByRole("menuitem", { name: action }).click();
  await expect(page.getByText(toast)).toBeVisible();
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
    await expect(page.getByText("口令至少需要 6 个字符")).toBeVisible();
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

  test("逐篇加密：加密后锁定显示解锁遮罩，解锁后正文重新装载", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openNote(page, "a", "正文");
    await openVaultSettings(page);
    await enableVault(page);
    await expect(page.getByText("仓库中已有 0 篇加密笔记")).toBeVisible();
    await closeSettings(page);

    // 编辑器「⋯」菜单逐篇加密：toast 反馈 + 元数据计数 +1
    await toggleEncryption(page, "加密此笔记", "已加密这篇笔记：仓库里只保留密文");
    await openVaultTab(page);
    await expect(page.getByText("仓库中已有 1 篇加密笔记")).toBeVisible();
    await page.getByRole("button", { name: "立即锁定" }).click();
    await expect(page.getByText("已锁定")).toBeVisible();
    await closeSettings(page);

    // 锁定态：编辑区被解锁遮罩接管，正文与编辑器都不可见
    await expect(page.getByText("这篇笔记已加密")).toBeVisible();
    await expect(page.getByText("a.md · 输入仓库口令后才能查看内容")).toBeVisible();
    await expect(page.locator(".cm-content")).toBeHidden();

    // 解锁后：note-content 失效重取，编辑器重新装载出明文（回归「解锁后编辑器重装载」）
    await page.getByRole("button", { name: "前往解锁" }).click();
    await page.getByLabel("仓库口令").fill("correct horse battery");
    await page.getByRole("button", { name: "解锁", exact: true }).click();
    await expect(page.getByText("加密笔记已解锁")).toBeVisible();
    await closeSettings(page);
    await expect(page.locator(".cm-content").first()).toContainText("正文", { timeout: 15_000 });
  });

  test("解密此笔记：加密态恢复为明文存储，元数据计数归零", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openNote(page, "a", "正文");
    await openVaultSettings(page);
    await enableVault(page);
    await closeSettings(page);

    await toggleEncryption(page, "加密此笔记", "已加密这篇笔记：仓库里只保留密文");
    // 解锁态下加密笔记仍按明文装载，菜单项随元数据翻转为「解密此笔记」
    await expect(page.locator(".cm-content").first()).toContainText("正文");
    await toggleEncryption(page, "解密此笔记", "已解密这篇笔记：正文恢复为明文存储");
    await expect(page.locator(".cm-content").first()).toContainText("正文");

    await openVaultTab(page);
    await expect(page.getByText("仓库中已有 0 篇加密笔记")).toBeVisible();
  });

  test("加密笔记冲突：密文不可逐行合并，只能整体保留一侧", async ({ page }) => {
    const state = baseState();
    state.conflicted = true;
    state.conflicts = [{ path: "a.md", local: "AINOTE-ENC-v1\nbG9jYWw=\n", remote: "AINOTE-ENC-v1\ncmVtb3Rl\n" }];
    await openWorkspace(page, state);

    await page.getByRole("button", { name: "解决同步冲突" }).click();
    // 降级面板：不渲染密文、不提供行级挑选，只保留二选一
    await expect(page.getByText(/密文之间没有可比较的行结构/)).toBeVisible();
    await expect(page.locator(".conflict-panel-body")).toBeHidden();
    await page.getByRole("button", { name: "保留本地", exact: true }).click();
    await expect(page.getByRole("button", { name: "解决同步冲突" })).toBeHidden();
  });
});
