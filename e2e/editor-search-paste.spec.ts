import { expect, test, type Page } from "@playwright/test";
import { calls, openNote, openWorkspace } from "./helpers";

const LIST_DOC = "- first\n- ";
const QUOTE_DOC = "> quote\n> ";
const PLAIN_DOC = "para ";

/** 桌面与移动共用编辑器，按两种视口各跑一次（跨端铁律）。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：查找替换面板与多行粘贴`, () => {
    test.use({ viewport });

    test("Mod+F 打开查找面板并显示中文标签", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "editor.md", content: PLAIN_DOC }] });
      await openNote(page, "editor", "para");

      await page.locator(".cm-content:visible").first().click();
      await page.keyboard.press("ControlOrMeta+f");

      const panel = page.locator(".cm-panel.cm-search:visible").first();
      await expect(panel).toBeVisible();
      await expect(panel.locator('input[name="search"]')).toHaveAttribute("placeholder", "查找");
      await expect(panel.locator('input[name="replace"]')).toHaveAttribute("placeholder", "替换");
      await expect(panel.getByRole("button", { name: "下一个" })).toBeVisible();
      await expect(panel.getByRole("button", { name: "全部替换" })).toBeVisible();
      await expect(panel.getByRole("button", { name: "关闭" })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    });

    test("查找框字号：移动端 ≥16px 避免聚焦缩放，桌面端保持紧凑", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "editor-font.md", content: PLAIN_DOC }] });
      await openNote(page, "editor-font", "para");

      await page.locator(".cm-content:visible").first().click();
      await page.keyboard.press("ControlOrMeta+f");
      const input = page.locator('.cm-panel.cm-search:visible input[name="search"]').first();
      await expect(input).toBeVisible();

      const size = await input.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      // 移动壳的全局规则会把可编辑控件抬到 16px（iOS 聚焦缩放防线），桌面端保持 13px 紧凑。
      if (viewport.width <= 767) expect(size).toBeGreaterThanOrEqual(16);
      else expect(size).toBeLessThanOrEqual(14);
    });

    test("查找面板可替换并写回编辑器", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "editor-replace.md", content: PLAIN_DOC }] });
      await openNote(page, "editor-replace", "para");

      await page.locator(".cm-content:visible").first().click();
      await page.keyboard.press("ControlOrMeta+f");
      const panel = page.locator(".cm-panel.cm-search:visible").first();
      await panel.locator('input[name="search"]').fill("para");
      await panel.locator('input[name="replace"]').fill("段落");
      await panel.getByRole("button", { name: "全部替换" }).click();

      await expect(page.locator(".cm-content:visible").first()).toContainText("段落");
    });

    test("列表项内多行粘贴保持缩进，第二行不脱出列表", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "paste-list.md", content: LIST_DOC }] });
      await openNote(page, "paste-list", "first");

      await focusEndOfDoc(page);
      await pasteText(page, "alpha\nbeta");

      expect(await savedContent(page)).toContain("- first\n- alpha\n  beta");
    });

    test("引用内多行粘贴补引用标记", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "paste-quote.md", content: QUOTE_DOC }] });
      await openNote(page, "paste-quote", "quote");

      await focusEndOfDoc(page);
      await pasteText(page, "alpha\nbeta");

      expect(await savedContent(page)).toContain("> quote\n> alpha\n> beta");
    });

    test("普通段落多行粘贴不补前缀", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "paste-plain.md", content: PLAIN_DOC }] });
      await openNote(page, "paste-plain", "para");

      await focusEndOfDoc(page);
      await pasteText(page, "alpha\nbeta");

      const saved = await savedContent(page);
      expect(saved).toContain("para alpha\nbeta");
      expect(saved).not.toContain("  beta");
    });
  });
}

/** 焦点落入编辑器并把光标移到文档末尾。 */
async function focusEndOfDoc(page: Page): Promise<void> {
  await page.locator(".cm-content:visible").first().click();
  await page.keyboard.press("ControlOrMeta+End");
}

/** 最近一次落盘内容：避开软渲染隐藏标记带来的 DOM 文本差异。 */
async function savedContent(page: Page): Promise<string> {
  await expect
    .poll(async () => (await calls(page)).filter((call) => call.cmd === "update_note").length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
  return String(updates.at(-1)?.args.content ?? "");
}

/** 派发带 text/plain 的粘贴事件：CodeMirror 的 paste 处理器同步读取 clipboardData。 */
async function pasteText(page: Page, text: string): Promise<void> {
  await page.locator(".cm-content:visible").first().evaluate((node, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}
