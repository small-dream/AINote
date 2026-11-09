import { expect, test } from "@playwright/test";
import { calls, openWorkspace } from "./helpers";

const command = "./gradlew.bat :freeprints:assembleUs\\_flaNormalRelease";
const escaped = "转义 \\*星号\\* 与 \\[括号\\]";
const content = `根目录\n\n${command}\n\n${escaped}`;

for (const mobile of [false, true]) {
  test.describe(mobile ? "移动端转义文本选区" : "桌面端转义文本选区", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile });

    test("选中正文不会暴露转义反斜杠，源码保持不变", async ({ page }) => {
      await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "escapes.md", content }] });
      await page.getByRole("button", { name: "escapes", exact: true }).first().click();

      for (const source of [command, escaped]) {
        const visible = source.replaceAll("\\", "");
        const line = page.locator(".cm-line").filter({ hasText: visible });
        await line.dblclick();
        await expect(line).toHaveText(visible);
        await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(visible);
      }

      await page.getByRole("tab", { name: "源码", exact: true }).click();
      await expect(page.locator(".cm-content")).toContainText(command);
      await expect(page.locator(".cm-content")).toContainText(escaped);
      expect((await calls(page)).filter((call) => call.cmd === "update_note")).toHaveLength(0);
    });
  });
}
