import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

const fence = String.fromCharCode(96).repeat(3);
const code = "const 标题 = '中文';\n\tconsole.log(标题);\n" + "verylongunbrokenstring".repeat(12);
const markdown = "## 代码\n\n" + fence + "typescript\n" + code + "\n" + fence + "\n";
const rich = JSON.stringify({ type: "doc", content: [
  { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "代码" }] },
  { type: "codeBlock", attrs: { language: "typescript" }, content: [{ type: "text", text: code }] },
] });
const state = (path: string, content: string, kind?: "richText"): E2eState => ({
  repoPath: "/mock-repo", notes: [{ path, content, ...(kind ? { kind } : {}) }],
});

async function installClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { __COPIED_CODE__?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { state.__COPIED_CODE__ = text; } },
    });
  });
}

test("Markdown preview uses reading surface, copies source, wraps temporarily and fits 320px", async ({ page }) => {
  await installClipboard(page);
  await page.setViewportSize({ width: 320, height: 820 });
  await openWorkspace(page, state("snippet.md", markdown));
  await page.getByRole("button", { name: "snippet", exact: true }).first().click();
  await page.getByRole("tab", { name: "预览" }).click();
  const block = page.locator(".markdown-code-block").first();
  await expect(block.locator(".note-code-actions")).toBeVisible();
  await expect(block.locator(".note-code-language")).toHaveText("typescript");
  const scrollbar = block.locator(".markdown-code-scrollbar");
  await expect(scrollbar).toHaveCount(1);
  await expect.poll(() => scrollbar.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await block.hover();
  await expect.poll(() => scrollbar.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.mouse.move(0, 0);
  await expect.poll(() => scrollbar.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const before = (await calls(page)).filter((call) => call.cmd === "update_note").length;
  await block.getByRole("button", { name: "复制代码" }).click();
  await expect(block.getByRole("status")).toHaveText("已复制");
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { __COPIED_CODE__?: string }).__COPIED_CODE__))
    .toBe(code + "\n");
  await block.getByRole("button", { name: "自动换行" }).click();
  await expect(block.locator("pre")).toHaveClass(/note-code-wrapped/);
  await expect(block.getByRole("button", { name: "取消自动换行" })).toBeVisible();
  await expect.poll(async () => (await calls(page)).filter((call) => call.cmd === "update_note").length).toBe(before);
});

test("Soft render operations stay outside source editor state", async ({ page }) => {
  await installClipboard(page);
  await openWorkspace(page, state("soft.md", markdown));
  await page.getByRole("button", { name: "soft", exact: true }).first().click();
  const block = page.locator(".cm-sr-codeblock-widget").first();
  await expect(block.locator(".note-code-actions")).toBeVisible();
  const before = (await calls(page)).filter((call) => call.cmd === "update_note").length;
  await block.getByRole("button", { name: "自动换行" }).click();
  await block.getByRole("button", { name: "复制代码" }).click();
  await expect(block.locator("pre")).toHaveClass(/note-code-wrapped/);
  await expect.poll(async () => (await calls(page)).filter((call) => call.cmd === "update_note").length).toBe(before);
  await expect(page.locator(".cm-content")).not.toContainText("复制代码");
});

/** 单行 + 横向溢出：渲染态高度应只由正文决定，编辑态不应把 ``` 显示出来。 */
const singleLine =
  "note\n\n" + fence + "\n" +
  '8B8D20F1 | spath method | search method="prints.remote" OR method="prints.local" OR method="prints.other"\n' +
  fence + "\n\nafter\n";

test("Soft render code block hugs content and hides fences while editing", async ({ page }) => {
  await openWorkspace(page, state("compact.md", singleLine));
  await page.getByRole("button", { name: "compact", exact: true }).first().click();
  const block = page.locator(".cm-sr-codeblock-widget").first();
  await expect(block.locator(".note-code-actions")).toBeVisible();
  // 操作按钮横排：竖排会把只有一行的代码块撑出一大片底部空白。
  const metrics = await block.evaluate((el) => {
    const buttons = Array.from(el.querySelectorAll(".note-code-actions button"));
    return {
      tops: buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      actionsHeight: el.querySelector(".note-code-actions")?.getBoundingClientRect().height ?? 0,
      blockHeight: el.getBoundingClientRect().height,
      preHeight: el.querySelector("pre")?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(new Set(metrics.tops).size).toBe(1);
  expect(metrics.actionsHeight).toBeLessThanOrEqual(32);
  expect(metrics.blockHeight).toBeLessThan(metrics.preHeight + 60);

  await block.locator("pre").click();
  await expect(page.locator(".cm-sr-codeblock-widget")).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("spath method");
  // 围栏行仍占一行（充当块内边距），但 DOM 里没有 ```；光标不在围栏上时不淡显。
  await expect(page.locator(".cm-content")).not.toContainText(fence);
  await expect(page.locator(".cm-sr-codeblock-line-first")).toHaveText("");
  await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
  await expect(page.locator(".cm-line .cm-sr-code-text")).toContainText("spath method");
});

test("Rich text controls and language selection do not corrupt serialized content", async ({ page }) => {
  await installClipboard(page);
  await openWorkspace(page, state("rich.ainote", rich, "richText"));
  await page.getByRole("button", { name: "rich", exact: true }).first().click();
  await expect(page.locator(".ProseMirror code")).toContainText("console.log", { timeout: 15_000 });
  const block = page.locator(".code-block-shell").first();
  await expect(block.locator(".note-code-actions")).toBeVisible();
  const before = (await calls(page)).filter((call) => call.cmd === "update_note").length;
  await block.getByRole("button", { name: "自动换行" }).click();
  await block.getByRole("button", { name: "复制代码" }).click();
  await expect(block.locator("pre")).toHaveClass(/note-code-wrapped/);
  await block.locator("select").selectOption("rust");
  await expect(block.locator("select")).toHaveValue("rust");
  await expect.poll(async () => (await calls(page)).filter((call) => call.cmd === "update_note").length).toBeGreaterThan(before);
  await expect(block.locator("code")).toContainText("console.log");
  expect(await block.locator("code").evaluate((node) => getComputedStyle(node).fontSize))
    .toBe(await block.locator("pre").evaluate((node) => getComputedStyle(node).fontSize));
  await expect(block.locator("button")).toHaveCount(2);
});

test.describe("移动窄屏代码块", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("预览支持触控自动换行", async ({ page }) => {
    await installClipboard(page);
    await openWorkspace(page, state("mobile-code.md", markdown));
    await page.getByRole("button", { name: "mobile-code", exact: true }).first().click();
  await page.getByRole("tab", { name: "预览" }).click();
    const block = page.locator(".markdown-code-block").first();
    await expect(block.getByRole("button", { name: "复制代码" })).toBeVisible();
    // 触屏按钮保持 44px 命中区，但两个按钮仍在同一行，块高不因操作区翻倍。
    const tops = await block.locator(".note-code-actions button")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await block.getByRole("button", { name: "自动换行" }).click();
    await expect(block.locator("pre")).toHaveClass(/note-code-wrapped/);
  });
});
