import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openNote, openWorkspace } from "./helpers";

const FEEL_NOTES: E2eState["notes"] = [
  { path: "alpha.md", content: "alpha body" },
  { path: "beta.md", content: "beta body" },
  { path: "docs/guide.md", content: "# Guide\n\nrust markdown" },
  {
    path: "docs/guide.ainote",
    kind: "richText",
    content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "rust rich text" }] }] }),
  },
  { path: "notes/other.md", content: "# Other\n\nrust elsewhere" },
];

function feelState(): E2eState {
  return { repoPath: "/mock-repo", notes: FEEL_NOTES };
}

for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 390, height: 844 } },
]) {
  test.describe(`${name}：编辑手感`, () => {
    test.use({ viewport });

    test("专注模式收起导航，状态栏显示字数行列并可切换打字机滚动", async ({ page }) => {
      await openWorkspace(page, feelState());
      await openNote(page, "alpha", "alpha body");
      const status = page.locator(".editor-status-bar").first();
      await expect(status).toContainText("9 字");
      await expect(status).toContainText("第 1 行，第 1 列");

      await page.locator(".cm-content:visible").first().click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type("\nnext");
      await expect(status).toContainText("第 2 行，第 5 列");

      const typewriter = status.getByRole("button", { name: "开启打字机滚动" });
      await typewriter.click();
      await expect(status.getByRole("button", { name: "关闭打字机滚动" })).toHaveAttribute("aria-pressed", "true");

      await status.getByRole("button", { name: "专注模式" }).click();
      await expect(status.getByRole("button", { name: "退出专注模式" })).toBeVisible();
      if (viewport.width < 768) {
        await expect(page.locator(".mobile-workspace-header button")).toHaveCount(2);
      } else {
        await expect(page.locator(".workspace-nav-rail")).toHaveCount(0);
        await expect(page.locator(".workspace-sidebar")).toHaveCount(0);
      }

      await status.getByRole("button", { name: "退出专注模式" }).click();
      if (viewport.width < 768) {
        await expect(page.locator(".mobile-workspace-header button").first()).toBeVisible();
      } else {
        await expect(page.locator(".workspace-nav-rail")).toBeVisible();
        await expect(page.locator(".workspace-sidebar")).toBeVisible();
      }
    });

    test("后退 / 前进按打开顺序切换笔记", async ({ page }) => {
      await openWorkspace(page, feelState());
      await openNote(page, "alpha", "alpha body");
      await openSecondNote(page, viewport.width);

      await page.getByRole("button", { name: "后退到上一篇笔记" }).click();
      await expect(page.locator(".cm-content:visible").first()).toContainText("alpha body", { timeout: 15_000 });
      await page.getByRole("button", { name: "前进到下一篇笔记" }).click();
      await expect(page.locator(".cm-content:visible").first()).toContainText("beta body", { timeout: 15_000 });
    });

    test("搜索按类型和目录筛选，并高亮命中词", async ({ page }) => {
      await openWorkspace(page, feelState());
      await page.keyboard.press("ControlOrMeta+k");
      const dialog = page.getByRole("dialog", { name: "命令面板" });
      await dialog.getByPlaceholder("输入命令或搜索笔记…").fill("rust");

      await expect(dialog.getByText("3 条结果")).toBeVisible();
      await expect(dialog.locator("mark").first()).toBeVisible();
      await dialog.getByLabel("笔记类型").selectOption("richText");
      await expect(dialog.getByText("1 / 3 条")).toBeVisible();
      await expect(dialog.getByRole("listbox")).toContainText("docs/guide.ainote");
      await expect(dialog.getByRole("listbox")).not.toContainText("docs/guide.md");

      await dialog.getByLabel("笔记类型").selectOption("all");
      await dialog.getByLabel("目录范围").selectOption("docs");
      await expect(dialog.getByText("2 / 3 条")).toBeVisible();
      await expect(dialog.getByRole("listbox")).toContainText("docs/guide.md");
      await expect(dialog.getByRole("listbox")).not.toContainText("notes/other.md");
    });
  });
}

async function openSecondNote(page: Page, width: number): Promise<void> {
  if (width < 768) {
    await page.getByRole("button", { name: "返回列表" }).click();
    await expect(page.getByRole("button", { name: "beta", exact: true })).toBeVisible();
  }
  await openNote(page, "beta", "beta body");
}
