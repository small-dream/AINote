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

async function discard(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: "丢弃本地改动" });
  await dialog.getByRole("checkbox", { name: "全选" }).check();
  await dialog.getByRole("button", { name: "丢弃选中改动" }).click();
  const confirm = page.getByRole("dialog", { name: "确认丢弃本地改动" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("checkbox", { name: "我了解这些改动丢弃后无法恢复" }).check();
  await confirm.getByRole("button", { name: "确认丢弃" }).click();
  await expect(confirm).not.toBeVisible();
}

test.describe("丢弃本地改动（P1）", () => {
  test("桌面：全选 → 勾选确认 → 调用 git_discard_changes 并按选定路径清空变更", async ({ page }) => {
    await openWorkspace(page, pendingState());

    await page.getByRole("button", { name: "丢弃本地改动" }).click();
    const dialog = page.getByRole("dialog", { name: "丢弃本地改动" });
    await expect(dialog.locator("li", { hasText: "daily/a.md" })).toBeVisible();
    await expect(dialog.getByText("已选 0 / 2 个文件")).toBeVisible();

    await dialog.getByRole("checkbox").first().check();
    await expect(dialog.getByText("已选 2 / 2 个文件")).toBeVisible();
    await dialog.getByRole("button", { name: "丢弃选中改动" }).click();

    const confirm = page.getByRole("dialog", { name: "确认丢弃本地改动" });
    await expect(confirm.getByText("将彻底删除（不可恢复）：1 个文件")).toBeVisible();
    await expect(confirm.getByRole("button", { name: "确认丢弃" })).toBeDisabled();
    await confirm.getByRole("checkbox", { name: "我了解这些改动丢弃后无法恢复" }).check();
    await confirm.getByRole("button", { name: "确认丢弃" }).click();
    await expect(confirm).not.toBeVisible();

    const discardCalls = (await calls(page)).filter((call) => call.cmd === "git_discard_changes");
    expect(discardCalls.length).toBe(1);
    expect(discardCalls[0].args.paths).toEqual(["daily/a.md", "new.md"]);

    // 变更已清空：重新打开面板是空态
    await page.getByRole("button", { name: "丢弃本地改动" }).click();
    await expect(page.getByText("没有可丢弃的改动")).toBeVisible();
  });

  test("移动窄屏：头部入口以 Bottom Sheet 打开并完成丢弃", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkspace(page, pendingState());

    await page.getByRole("button", { name: "丢弃本地改动" }).click();
    const dialog = page.getByRole("dialog", { name: "丢弃本地改动" });
    await expect(dialog).toBeVisible();
    const bottomSheet = await dialog.evaluate((node) => {
      const overlay = node.parentElement;
      return overlay ? getComputedStyle(overlay).alignItems : "";
    });
    expect(bottomSheet).toBe("flex-end");

    await discard(page);
    const discardCalls = (await calls(page)).filter((call) => call.cmd === "git_discard_changes");
    expect(discardCalls.length).toBe(1);
    expect(discardCalls[0].args.paths).toEqual(["daily/a.md", "new.md"]);
  });
});
