import { expect, test, type Locator } from "@playwright/test";
import { openWorkspace } from "./helpers";

const TEXT = "选择这段文字进行复制";
const NOTE = {
  repoPath: "/mock-repo",
  notes: [
    { path: "copy.md", content: TEXT },
    { path: "rich.ainote", kind: "richText" as const, content: JSON.stringify({
      type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: TEXT }] }],
    }) },
  ],
};

async function selectText(surface: Locator): Promise<void> {
  await surface.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    if (!text) throw new Error("没有可选文字");
    const range = document.createRange();
    range.selectNodeContents(text);
    if (element instanceof HTMLElement) element.focus();
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
}

async function contextMenuAllowed(surface: Locator, pointerType: string): Promise<boolean> {
  return surface.evaluate((element, type) => element.dispatchEvent(new PointerEvent("contextmenu", {
    bubbles: true, cancelable: true, pointerType: type, clientX: 80, clientY: 240,
  })), pointerType);
}

test.describe("移动端正文长按", () => {
  test.use({ viewport: { width: 402, height: 874 }, hasTouch: true });

  for (const mode of ["写作", "源码", "预览", "富文本"]) {
    test(`${mode}：长按不叠加应用菜单、不拦截系统菜单、不改变选区`, async ({ page }) => {
      await openWorkspace(page, NOTE);
      const rich = mode === "富文本";
      await page.getByRole("button", { name: rich ? "rich" : "copy", exact: true }).first().click();
      if (!rich) await page.getByRole("tab", { name: mode, exact: true }).click();
      const surface = page.locator(rich ? ".ProseMirror" : mode === "预览" ? ".note-preview-pane" : ".cm-content").first();
      await expect(surface).toContainText(TEXT);
      await selectText(surface);
      await surface.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 80, clientY: 240 });
      await page.waitForTimeout(600);
      await expect(page.getByRole("menuitem", { name: "复制", exact: true })).toHaveCount(0);
      expect(await contextMenuAllowed(surface, "touch")).toBe(true);
      await surface.dispatchEvent("pointerup", { pointerType: "touch" });
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(TEXT);
      await expect(page.getByRole("menuitem", { name: "复制", exact: true })).toHaveCount(0);
    });
  }
});

test.describe("桌面正文右键", () => {
  for (const mode of ["写作", "预览", "富文本"]) {
    test(`${mode}：鼠标右键保留应用复制菜单`, async ({ page }) => {
      await openWorkspace(page, NOTE);
      const rich = mode === "富文本";
      await page.getByRole("button", { name: rich ? "rich" : "copy", exact: true }).first().click();
      if (mode === "预览") await page.getByRole("tab", { name: "预览", exact: true }).click();
      const surface = page.locator(rich ? ".ProseMirror" : mode === "预览" ? ".note-preview-pane" : ".cm-content").first();
      await expect(surface).toContainText(TEXT);
      await selectText(surface);
      expect(await contextMenuAllowed(surface, "mouse")).toBe(false);
      await expect(page.getByRole("menuitem", { name: "复制", exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(TEXT);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menuitem", { name: "复制", exact: true })).toHaveCount(0);
    });
  }
});
