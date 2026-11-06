import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

const STATE: E2eState = {
  repoPath: "/mock-repo",
  notes: [{ path: "existing.md", content: "# 已有笔记\n" }],
  moveNoteDelayMs: 3_500,
};

const VIEWPORTS = [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 390, height: 844 } },
];

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`${name}：未命名 Markdown 后补标题`, () => {
    test.use({ viewport });

    test("先写正文再补标题只保留改名后的笔记，不把草稿写回旧路径", async ({ page }) => {
      await openWorkspace(page, STATE);
      await createUntitledMarkdownNote(page);

      await page.locator(".cm-content:visible").first().click();
      await page.keyboard.insertText("先写正文，再补标题。");

      const title = page.getByLabel("笔记标题").first();
      await title.fill("文章标题");
      await title.press("Enter");
      await page.locator(".cm-content:visible").first().click();
      await expect(title).toBeDisabled();
      await expect(title).toBeEnabled({ timeout: 10_000 });

      if (viewport.width < 600) {
        await page.getByRole("button", { name: "返回列表" }).click();
        await expect(page.getByText("全部笔记").first()).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "文章标题", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "未命名", exact: true })).toHaveCount(0);

      const records = await calls(page);
      const moveIndex = records.findIndex((record) => record.cmd === "move_note");
      expect(moveIndex).toBeGreaterThanOrEqual(0);
      const writesAfterMove = records.slice(moveIndex + 1).filter(
        (record) => record.cmd === "update_note" && record.args.path === "未命名.md",
      );
      expect(writesAfterMove).toHaveLength(0);
    });
  });
}

async function createUntitledMarkdownNote(page: Page): Promise<void> {
  await page.getByRole("button", { name: "创建", exact: true }).first().click();
  await page.getByRole("button", { name: "Markdown 笔记 .md", exact: true }).click();
  await expect(page.getByLabel("笔记标题")).toBeFocused();
}
