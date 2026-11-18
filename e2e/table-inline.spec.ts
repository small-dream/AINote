import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openNote, openWorkspace } from "./helpers";

const CONTENT = "| 样式 | 代码 |\n| --- | --- |\n| **经典单层** | 一个 `cutout` 槽 |\n";

function seed(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "table-inline.md", content: CONTENT }] };
}

for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 390, height: 844 } },
]) {
  test.describe(`${name}：写作模式表格行内 Markdown`, () => {
    test.use({ viewport });

    test("静态态隐藏加粗与行内代码标记，聚焦后回到源码", async ({ page }) => {
      await openWorkspace(page, seed());
      await openNote(page, "table-inline", "经典单层");

      const table = page.locator(".cm-sr-table:visible").first();
      const boldCell = table.locator('[data-sr-row="1"][data-sr-col="0"]');
      const codeCell = table.locator('[data-sr-row="1"][data-sr-col="1"]');
      await expect(boldCell.locator("strong")).toHaveText("经典单层");
      await expect(codeCell.locator("code")).toHaveText("cutout");
      await expect(boldCell).not.toContainText("**");
      await expect(codeCell).not.toContainText("`");

      await boldCell.focus();
      await expect(boldCell).toHaveText("**经典单层**");
      await expect(boldCell.locator("strong")).toHaveCount(0);
    });
  });
}
