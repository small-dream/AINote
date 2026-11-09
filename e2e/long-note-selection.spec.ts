import { expect, test } from "@playwright/test";
import { calls, openWorkspace } from "./helpers";

const fence = "`".repeat(3);
const paragraphs = ["jumpAfterSuccessPaid", "后续文字同样可以完整选择", "末尾正文依然可以选择"];
const code = Array.from({ length: 60 }, (_, index) => `run(${index});`).join("\n");
const content = `# 长笔记\n\n${fence}js\n${code}\n${fence}\n\n${paragraphs.join("\n\n")}`;

for (const mobile of [false, true]) {
  test.describe(mobile ? "移动端长笔记选区" : "桌面端长笔记选区", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile });

    test("滚动超过首屏后，正文选区保持完整且不改动笔记", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "long-selection.md", content }] });
      await page.getByRole("button", { name: "long-selection", exact: true }).first().click();

      for (const text of paragraphs) {
        const line = page.locator(".cm-line").filter({ hasText: text });
        await line.scrollIntoViewIfNeeded();
        await line.dblclick();
        await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(text);
        expect(await page.locator(".cm-scroller").evaluate((element) => element.scrollTop > element.clientHeight)).toBe(true);
        // IntersectionObserver 会计入祖先 clip-path 的裁切，避免只有 DOM 选区正确但高亮不可见。
        const highlights = page.locator(".cm-selectionBackground");
        await expect(highlights.first()).toBeAttached();
        for (const highlight of await highlights.all()) await expect(highlight).toBeInViewport({ ratio: 1 });
      }

      expect((await calls(page)).filter((call) => call.cmd === "update_note")).toHaveLength(0);
    });
  });
}
