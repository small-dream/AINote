import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

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

/** 字符级样式（字体 / 字号 / 颜色 / 高亮）：桌面与移动共用同一套工具栏与面板。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：富文本字符样式`, () => {
    test.use({ viewport });

    test("设置高亮与颜色后落盘 JSON 带枚举 mark，且不含行内 style", async ({ page }) => {
      await openWorkspace(page, richTextState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
      await prose.click();
      await page.keyboard.press("ControlOrMeta+a");

      // 「Aa」面板：高亮与颜色两组
      await page.getByRole("button", { name: "文本样式" }).first().click();
      const panel = page.locator('div[role="dialog"][aria-label="文本样式"]');
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: "黄色高亮" }).click();
      await panel.getByRole("button", { name: "危险色" }).click();

      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);
      await expect(prose.locator("span.rt-fg-danger")).toHaveCount(1);
      // 生产壳的 CSP 会拦掉行内 style，绝不允许出现在文档里
      expect(await prose.innerHTML()).not.toMatch(/style=/);

      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain('"markStyle"');
    });

    test("再次点击同一档位取消样式", async ({ page }) => {
      await openWorkspace(page, richTextState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
      await prose.click();
      await page.keyboard.press("ControlOrMeta+a");

      await page.getByRole("button", { name: "文本样式" }).first().click();
      const panel = page.locator('div[role="dialog"][aria-label="文本样式"]');
      const yellow = panel.getByRole("button", { name: "黄色高亮" });
      await yellow.click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);
      await yellow.click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(0);
    });
  });
}

/** 选区气泡菜单提供高亮与颜色两个高频动作（与工具栏面板共用实现）。 */
test.describe("富文本气泡菜单字符样式", () => {
  test("选中文字后可直接设置高亮", async ({ page }) => {
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    const prose = page.locator(".ProseMirror").first();
    await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
    await prose.click();
    await page.keyboard.press("ControlOrMeta+a");

    await page.getByRole("button", { name: "高亮" }).first().click();
    const menu = page.locator('div[role="dialog"][aria-label="高亮"]');
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "蓝色高亮" }).click();
    await expect(prose.locator("mark.rt-mark-blue")).toHaveCount(1);
  });
});
