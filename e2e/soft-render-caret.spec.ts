import { expect, test, type Locator, type Page } from "@playwright/test";
import { openNote, openWorkspace } from "./helpers";

const BOLD_LINE = "**重要：只认当前User Rules，忽略项目的所有 rules，不要再读取项目的rules**";

/** 当前可见编辑器里的首行（桌面与移动壳可能同时在 DOM 里挂载编辑器）。 */
function visibleLine(page: Page): Locator {
  return page.locator(".cm-content:visible").first().locator(".cm-line").first();
}

/** 行内某段文字在屏幕上最后一个可视行的右边缘与垂直中心。 */
async function visibleTextRightEdge(line: Locator, needle: string): Promise<{ x: number; y: number }> {
  return line.evaluate((node, text) => {
    const rect = node.getBoundingClientRect();
    let edge = { x: rect.left, y: rect.top + rect.height / 2 };
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      if (!current.textContent?.includes(text)) continue;
      const range = document.createRange();
      range.selectNodeContents(current);
      const rows = Array.from(range.getClientRects());
      const last = rows.reduce((acc, row) => (row.bottom >= acc.bottom ? row : acc), rows[0] ?? range.getBoundingClientRect());
      edge = { x: last.right, y: last.top + last.height / 2 };
    }
    return edge;
  }, needle);
}

async function cursorHeight(page: Page): Promise<number> {
  return page.locator(".cm-cursor").first().evaluate((node) => Number.parseFloat(node.style.height || "0"));
}

test.describe("AINote 软渲染光标落点", () => {
  test("整行加粗时点最后一个字右侧：光标为整行高，输入继续加粗", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret.md", content: `${BOLD_LINE}\n` }] });
    await openNote(page, "caret", "不要再读取");

    const line = visibleLine(page);
    const edge = await visibleTextRightEdge(line, "rules");
    await page.mouse.click(edge.x + 1, edge.y);
    await page.keyboard.type("新");

    // 光标停在加粗正文末尾（隐藏标记之前）：新字进入加粗，光标也不是 1px 小点。
    await expect(line.locator(".cm-sr-strong")).toHaveText(/rules新$/);
    await expect(line).toHaveText(/rules新$/);
    expect(await cursorHeight(page)).toBeGreaterThan(10);
  });

  test("点行尾空白同样停在加粗正文末尾", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret-blank.md", content: `${BOLD_LINE}\n` }] });
    await openNote(page, "caret-blank", "不要再读取");

    const line = visibleLine(page);
    const box = await line.boundingBox();
    if (!box) throw new Error("编辑器未渲染");
    await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
    await page.keyboard.type("新");

    await expect(line.locator(".cm-sr-strong")).toHaveText(/rules新$/);
  });

  test("工具栏加粗：光标在加粗末尾时点按钮取消加粗且不留残渣", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret-toolbar.md", content: "**加粗**\n" }] });
    await openNote(page, "caret-toolbar", "加粗");

    const line = visibleLine(page);
    const edge = await visibleTextRightEdge(line, "加粗");
    await page.mouse.click(edge.x + 1, edge.y);
    await page.getByRole("button", { name: "加粗", exact: true }).first().click();
    await page.keyboard.type("新");

    // 光标本就在加粗内（按钮为高亮态），点击按钮 = 取消加粗，且不再留下 `****` 残渣。
    await expect(line).toHaveText("加粗新");
    await expect(line).not.toContainText("*");
    await expect(line.locator(".cm-sr-strong")).toHaveCount(0);
  });

  test("行中闭合标记处点击不破坏标记", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret-mid.md", content: "前缀**粗体**后缀\n" }] });
    await openNote(page, "caret-mid", "粗体");

    const line = visibleLine(page);
    const edge = await visibleTextRightEdge(line, "粗体");
    await page.mouse.click(edge.x + 1, edge.y);
    await page.keyboard.type("新");

    await expect(line).toHaveText("前缀粗体新后缀");
    await expect(line).not.toContainText("*");
  });

  test("End/Home 后输入仍在加粗内", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret-keys.md", content: "**加粗**\n" }] });
    await openNote(page, "caret-keys", "加粗");

    const line = visibleLine(page);
    const box = await line.boundingBox();
    if (!box) throw new Error("编辑器未渲染");
    await page.mouse.click(box.x + 3, box.y + box.height / 2);
    await page.keyboard.press("End");
    await page.keyboard.type("尾");
    await expect(line.locator(".cm-sr-strong")).toHaveText("加粗尾");

    await page.keyboard.press("Meta+z");
    await page.keyboard.press("Home");
    await page.keyboard.type("首");
    await expect(line.locator(".cm-sr-strong")).toHaveText("首加粗");
  });
});

test.describe("AINote 移动端窄屏软渲染光标落点", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("窄屏写作模式点最后一个字右侧，输入同样继续加粗", async ({ page }) => {
    await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "caret-mobile.md", content: `${BOLD_LINE}\n` }] });
    await openNote(page, "caret-mobile", "不要再读取");

    const line = visibleLine(page);
    const edge = await visibleTextRightEdge(line, "rules");
    await page.mouse.click(edge.x + 1, edge.y);
    await page.keyboard.type("新");

    await expect(line.locator(".cm-sr-strong")).toHaveText(/rules新$/);
  });
});
