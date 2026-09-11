import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openWorkspace } from "./helpers";

function richTextState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "选中这段文字加链接" }] }],
        }),
      },
    ],
  };
}

test.describe("富文本编辑器", () => {
  test("打开富文本笔记正常渲染,不崩溃", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    await expect(page.locator(".ProseMirror").first()).toContainText("选中这段文字加链接", { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("Mod-k 打开链接输入,裸域名自动补全协议并写入文档", async ({ page }) => {
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+k");

    const input = page.locator('div[role="dialog"][aria-label="链接"] input');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("example.com");
    await page.keyboard.press("Enter");

    const link = page.locator(".ProseMirror a.link-mark");
    await expect(link).toHaveAttribute("href", "https://example.com");
    await expect(link).toContainText("选中这段文字加链接");
  });
});
