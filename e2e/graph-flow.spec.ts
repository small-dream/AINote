import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function graphState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
    repoHistory: [
      { id: "300", message: "feat: add graph", files: [
        { path: "daily/a.md", status: "modified" },
        { path: "new.md", status: "added" },
      ] },
      { id: "200", message: "fix: typo", files: [{ path: "daily/a.md", status: "modified" }] },
      { id: "100", message: "feat: init", files: [{ path: "daily/a.md", status: "added" }] },
    ],
    versions: {
      "daily/a.md": [
        { path: "daily/a.md", id: "300", message: "feat: add graph", content: "# 笔记\n\nGraph 内容" },
        { path: "daily/a.md", id: "200", message: "fix: typo", content: "# 笔记\n\n正文" },
        { path: "daily/a.md", id: "100", message: "feat: init", content: "# 笔记" },
      ],
    },
  };
}

test.describe("Repo Git Graph（阶段 B）", () => {
  test("桌面：打开面板，展示提交列表、改动文件与 diff", async ({ page }) => {
    await openWorkspace(page, graphState());

    await page.getByRole("button", { name: "Git 历史" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Git 历史" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // 默认选中最新提交：文件列表出现两个改动文件，diff 区域渲染该提交的版本内容
    await expect(dialog.locator("li", { hasText: "daily/a.md" }).first()).toBeVisible();
    await expect(dialog.locator("li", { hasText: "new.md" })).toBeVisible();
    await expect(dialog.getByText("daily/a.md @ 300")).toBeVisible();

    // 切换提交：文件列表收敛为该提交的改动文件，diff 同步切换
    await dialog.locator("li", { hasText: "fix: typo" }).first().click();
    await expect(dialog.locator("li", { hasText: "new.md" })).toHaveCount(0);
    await expect(dialog.getByText("daily/a.md @ 200")).toBeVisible();

    const historyCalls = (await calls(page)).filter((call) => call.cmd === "git_repo_history");
    expect(historyCalls.length).toBe(1);
  });

  test("桌面：从历史版本恢复文件写入工作区", async ({ page }) => {
    await openWorkspace(page, graphState());

    await page.getByRole("button", { name: "Git 历史" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Git 历史" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.locator("li", { hasText: "fix: typo" }).first().click();
    await dialog.getByRole("button", { name: "恢复此版本" }).click();
    await expect(page.getByText("已恢复 daily/a.md")).toBeVisible();

    const restoreCalls = (await calls(page)).filter((call) => call.cmd === "git_restore_file");
    expect(restoreCalls.length).toBe(1);
    expect(restoreCalls[0]?.args).toMatchObject({ file: "daily/a.md", commitId: "200" });
  });

  test("移动窄屏：列表 Tab 打开 Git 历史面板", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, graphState());

    await page.getByRole("tab", { name: "Git 历史" }).click();
    const dialog = page.getByRole("dialog", { name: "Git 历史" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator("li", { hasText: "feat: add graph" }).first()).toBeVisible();
  });
});
