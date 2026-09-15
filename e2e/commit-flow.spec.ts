import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function pendingState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
    uncommitted: true,
    changedFiles: [
      { path: "daily/a.md", status: "modified" },
      { path: "new.md", status: "added" },
    ],
  };
}

test.describe("手动提交（阶段 A）", () => {
  test("桌面：打开提交面板，展示变更与默认 message，提交后关闭", async ({ page }) => {
    await openWorkspace(page, pendingState());

    await page.getByRole("button", { name: "提交版本" }).click();
    const dialog = page.getByRole("dialog", { name: "提交版本" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li", { hasText: "daily/a.md" })).toBeVisible();
    await expect(dialog.locator("li", { hasText: "new.md" })).toBeVisible();

    const textarea = dialog.getByLabel("提交说明");
    await expect(textarea).toHaveValue(/更新 2 个文件/);
    await expect(textarea).toHaveValue(/M daily\/a\.md/);

    await dialog.getByRole("button", { name: "提交" }).click();
    await expect(dialog).not.toBeVisible();
    const commits = (await calls(page)).filter((call) => call.cmd === "git_commit");
    expect(commits.length).toBe(1);
  });

  test("移动窄屏：头部出现提交入口，面板以 Bottom Sheet 打开", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, pendingState());

    await page.getByRole("button", { name: "提交版本" }).click();
    const dialog = page.getByRole("dialog", { name: "提交版本" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li", { hasText: "new.md" })).toBeVisible();

    const bottomSheet = await dialog.evaluate((node) => {
      const overlay = node.parentElement;
      return overlay ? getComputedStyle(overlay).alignItems : "";
    });
    expect(bottomSheet).toBe("flex-end");
  });

  test("移动窄屏：无待提交变更时不显示提交入口", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "daily/a.md", content: "# 笔记" }] });

    await expect(page.getByRole("button", { name: "提交版本" })).toHaveCount(0);
  });

  test("移动窄屏：待办变更后出现提交入口，且变更列表含 todos.json", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "daily/a.md", content: "# 笔记" }] });
    await expect(page.getByRole("button", { name: "提交版本" })).toHaveCount(0);

    await page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("写周报");
    await page.getByRole("button", { name: "添加任务" }).click();

    await page.getByRole("button", { name: "提交版本" }).click();
    const dialog = page.getByRole("dialog", { name: "提交版本" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li", { hasText: ".ainote/todos.json" })).toBeVisible();
  });

  test("桌面：待办变更后导航轨点亮待提交徽标", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "daily/a.md", content: "# 笔记" }] });
    const commitButton = page.getByRole("button", { name: "提交版本" });
    await expect(commitButton.locator("span")).toHaveCount(0);

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("写周报");
    await page.getByRole("button", { name: "添加任务" }).click();

    await expect(commitButton.locator("span")).toHaveCount(1);
  });
});
