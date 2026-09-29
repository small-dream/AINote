import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openNote, openWorkspace } from "./helpers";

function state(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "menu.md", content: "# 菜单键盘\n\n正文" }] };
}

/** 共享菜单原语（ToolbarMenu）的键盘路径：面板单一焦点域，方向键漫游、Escape/Tab 回焦触发按钮。 */
test.describe("菜单键盘可达性（桌面）", () => {
  test("顶栏「更多」：打开入焦、方向键漫游、Escape 关闭并回焦", async ({ page }) => {
    await openWorkspace(page, state());
    await openNote(page, "menu", "菜单键盘");

    const trigger = page.getByRole("button", { name: "更多" });
    await trigger.press("Enter");
    expect(await trigger.getAttribute("aria-expanded")).toBe("true");
    // 打开即把焦点移入面板首项，而不是停在触发按钮上
    await expect(page.getByRole("menuitem", { name: "笔记主题" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "笔记历史" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: "笔记主题" })).toBeFocused();

    // End 直达末项，再按 ArrowDown 循环回首项
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "笔记主题" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("顶栏「更多」：子视图中 Escape 先退回主列表，不关掉整个菜单", async ({ page }) => {
    await openWorkspace(page, state());
    await openNote(page, "menu", "菜单键盘");

    await page.getByRole("button", { name: "更多" }).press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio", { name: "森林" })).toBeVisible();

    await page.keyboard.press("Escape");
    // 菜单仍在（退回主列表），子视图消失，且焦点回到打开它的那一项
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page.getByRole("menuitemradio", { name: "森林" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "笔记主题" })).toBeFocused();
  });

  test("顶栏「更多」：Tab 关闭菜单并把焦点交回触发按钮", async ({ page }) => {
    await openWorkspace(page, state());
    await openNote(page, "menu", "菜单键盘");

    const trigger = page.getByRole("button", { name: "更多" });
    await trigger.press("Enter");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("导航轨「版本」：自定义触发按钮同样入焦、漫游并回焦", async ({ page }) => {
    await openWorkspace(page, state());

    const trigger = page.getByRole("button", { name: "版本", exact: true });
    await trigger.press("Enter");
    await expect(page.getByRole("menuitem", { name: "提交版本" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "丢弃本地改动" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
});
