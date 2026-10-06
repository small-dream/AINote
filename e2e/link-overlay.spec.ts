import { expect, test, type Locator, type Page } from "@playwright/test";
import { openNote, openWorkspace } from "./helpers";

const CONTENT = "# 联系\n\n邮箱 someone@example.com 与站点 https://example.com/a 都在这里\n";

/** 软渲染后的自动链接（邮箱与 http 外链共用 `cm-sr-autolink`）。 */
function autolink(page: Page, text: string): Locator {
  return page.locator(".cm-sr-autolink:visible").filter({ hasText: text }).first();
}

/** 桌面与移动共用编辑链路，按两种视口各跑一次，覆盖两个壳。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：链接动作浮层`, () => {
    test.use({ viewport });

    test("邮箱链接只给复制，不出现点了没反应的「访问」", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "contact.md", content: CONTENT }] });
      await openNote(page, "contact", "邮箱");

      await autolink(page, "someone@example.com").click();

      const dialog = page.getByRole("dialog", { name: "链接" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("someone@example.com");
      await expect(dialog.getByRole("button", { name: "复制邮箱" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "访问" })).toHaveCount(0);

      // 编辑入口与复制按钮同款（带文字），且回显去掉 mailto: 前缀
      await dialog.getByRole("button", { name: "编辑" }).click();
      await expect(page.locator("#link-popover-url")).toHaveValue("someone@example.com");
      await page.keyboard.press("Escape");

      // 复制后浮层关闭
      await autolink(page, "someone@example.com").click();
      await dialog.getByRole("button", { name: "复制邮箱" }).click();
      await expect(dialog).toHaveCount(0);
    });

    test("http 外链仍提供访问", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "contact.md", content: CONTENT }] });
      await openNote(page, "contact", "邮箱");

      await autolink(page, "https://example.com/a").click();

      const dialog = page.getByRole("dialog", { name: "链接" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "访问" })).toBeVisible();
    });
  });
}
