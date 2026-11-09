import { expect, test } from "@playwright/test";
import { calls, openWorkspace } from "./helpers";

const fence = "`".repeat(3);
const code = 'if (ready) {\n\nrun("2025007");\n\n}';
const content = `before\n\n${fence}js\n${code}\n${fence}\n\nafter`;

for (const mobile of [false, true]) {
  test.describe(mobile ? "移动端代码块选区" : "桌面端代码块选区", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile });

    test("全选经过两条围栏时保持隐藏且不改动笔记", async ({ page }, testInfo) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "selection.md", content }] });
      await page.getByRole("button", { name: "selection", exact: true }).first().click();
      await page.locator(".cm-sr-codeblock-widget pre").click();
      await page.keyboard.press("ControlOrMeta+a");
      await expect(page.locator(".cm-sr-code-selection").first()).toBeVisible();
      await expect(page.locator(".cm-sr-codeblock-line-first")).toHaveText("");
      await expect(page.locator(".cm-sr-codeblock-line-last")).toHaveText("");
      await expect(page.locator(".cm-content")).not.toContainText(fence);
      await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("code-selection.png") });

      await page.getByRole("tab", { name: "源码" }).click();
      await expect(page.locator(".cm-content")).toContainText(fence + "js");
      await expect(page.locator(".cm-content")).toContainText('run("2025007");');
      expect((await calls(page)).filter((call) => call.cmd === "update_note")).toHaveLength(0);
    });
  });
}
