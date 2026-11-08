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
  await expect(block.locator(".note-code-scrollbar")).toHaveCSS("opacity", "0");
  await block.hover();
  await expect(block.locator(".note-code-scrollbar")).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await expect(block.locator(".note-code-scrollbar")).toHaveCSS("opacity", "0");
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
  // 固定卡片结构含顶栏与底部滚动条；除这些固定高度外，正文不应撑出额外空白。
  expect(metrics.blockHeight).toBeLessThan(metrics.preHeight + 80);

  await block.locator("pre").click();
  await expect(page.locator(".cm-sr-codeblock-widget")).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("spath method");
  // 围栏行仍占一行（充当块内边距），但 DOM 里没有 ```；光标不在围栏上时不淡显。
  await expect(page.locator(".cm-content")).not.toContainText(fence);
  await expect(page.locator(".cm-sr-codeblock-line-first")).toHaveText("");
  await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
  await expect(page.locator(".cm-line .cm-sr-code-text")).toContainText("spath method");
  await expect(page.locator(".cm-sr-codeblock-header")).toBeVisible();
  await expect(page.locator(".cm-sr-codeblock-header select")).toHaveValue("");
  const languageOptions = await page.locator(".cm-sr-codeblock-header select option").allTextContents();
  expect(languageOptions).not.toContain("默认主题");
  await expect(page.locator(".cm-sr-codeblock-footer-track")).toBeVisible();
  await expect(page.locator(".cm-sr-codeblock-footer-track")).toHaveCSS("opacity", "1");
  const lineNumberWidths = await page.locator(".cm-sr-codeblock-body")
    .evaluateAll((lines) => lines.map((line) => getComputedStyle(line, "::before").width));
  expect(new Set(lineNumberWidths)).toEqual(new Set(["38px"]));
  const focusedCode = page.locator(".cm-line").filter({ has: page.locator(".cm-sr-code-text") }).first();
  await expect(focusedCode).toHaveCSS("white-space", "pre");
  const focusedMetrics = await focusedCode.evaluate((el) => {
    el.scrollLeft = 80;
    return {
      height: el.getBoundingClientRect().height,
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  });
  // 长行不换成多行：保持单行高度，并且能在代码行内横向滚动查看。
  expect(focusedMetrics.height).toBeLessThan(40);
  expect(focusedMetrics.scrollLeft).toBeGreaterThan(0);
  expect(focusedMetrics.scrollWidth).toBeGreaterThan(focusedMetrics.clientWidth);
  const track = page.locator(".cm-sr-codeblock-footer-track");
  await expect.poll(async () => Number(await track.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
});

test("Soft render short code block keeps its rendered height while editing", async ({ page }) => {
  const shortCode = "before\n\n" + fence + "\nconst a = 1;\n" + fence + "\n\nafter\n";
  await openWorkspace(page, state("short-code.md", shortCode));
  await page.getByRole("button", { name: "short-code", exact: true }).first().click();
  const block = page.locator(".cm-sr-codeblock-widget").first();
  await expect(block).toBeVisible();
  await expect(block.locator(".note-code-scrollbar")).toHaveCount(0);
  const before = await block.evaluate((el) => {
    const pre = el.querySelector("pre");
    return {
      height: el.getBoundingClientRect().height,
      top: el.getBoundingClientRect().top,
      font: pre ? getComputedStyle(pre).fontSize : "",
      lineHeight: pre ? getComputedStyle(pre).lineHeight : "",
    };
  });
  await block.locator("pre").click();
  const after = await page.locator(".cm-soft-render .cm-content").evaluate((content) => {
    const header = content.querySelector(".cm-sr-codeblock-header")?.getBoundingClientRect();
    const footer = content.querySelector(".cm-sr-codeblock-footer")?.getBoundingClientRect();
    const code = document.querySelector(".cm-sr-code-text");
    return {
      height: header && footer ? footer.bottom - header.top : 0,
      top: header?.top ?? 0,
      font: code ? getComputedStyle(code).fontSize : "",
      lineHeight: code ? getComputedStyle(code).lineHeight : "",
    };
  });
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  expect(after.font).toBe(before.font);
  expect(Number.parseFloat(after.lineHeight)).toBeCloseTo(Number.parseFloat(before.lineHeight), 1);
  // 短代码没有横向溢出时不渲染滚动条，也不暴露隐藏轨道。
  await expect(page.locator(".cm-sr-codeblock-footer-track")).toHaveCSS("opacity", "0");
  await expect(page.locator(".cm-sr-codeblock-footer-track")).toHaveAttribute("aria-hidden", "true");
});

test("Soft render hidden fence rows keep fences hidden when clicked", async ({ page }) => {
  await openWorkspace(page, state("fence-click.md", "before\n\n" + fence + "\nconst a = 1;\n" + fence + "\n\nafter\n"));
  await page.getByRole("button", { name: "fence-click", exact: true }).first().click();
  await page.locator(".cm-sr-codeblock-widget pre").click();
  const firstFence = await page.locator(".cm-line.cm-sr-codeblock-line-first").boundingBox();
  const lastFence = await page.locator(".cm-line.cm-sr-codeblock-line-last").boundingBox();
  if (!firstFence || !lastFence) throw new Error("hidden fence rows not measured");
  await page.mouse.click(firstFence.x + 80, firstFence.y + 6);
  await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
  await expect(page.locator(".cm-content")).not.toContainText(fence);
  await expect(page.locator(".cm-sr-codeblock-widget")).toHaveCount(0);
  await expect(page.getByText("第 4 行，第 1 列")).toBeVisible();
  const lastAfterOpeningClick = await page.locator(".cm-line.cm-sr-codeblock-line-last").boundingBox();
  if (!lastAfterOpeningClick) throw new Error("closing fence row disappeared after click");
  await page.mouse.click(lastAfterOpeningClick.x + 80, lastAfterOpeningClick.y + 6);
  await expect(page.locator(".cm-sr-marker")).toHaveCount(0);
  await expect(page.locator(".cm-content")).not.toContainText(fence);
  await expect(page.locator(".cm-sr-codeblock-widget")).toHaveCount(0);
  await expect(page.getByText("第 4 行，第 1 列")).toBeVisible();
});

test("Soft render code block double-click keeps selection inside the card", async ({ page }) => {
  await openWorkspace(page, state("code-selection.md", markdown));
  await page.getByRole("button", { name: "code-selection", exact: true }).first().click();
  const block = page.locator(".cm-sr-codeblock-widget").first();
  await expect(block).toBeVisible();
  await block.locator("pre").click();

  const wordLine = page.locator(".cm-line.cm-sr-codeblock-body").filter({ hasText: "console.log" }).first();
  const wordBox = await wordLine.boundingBox();
  if (!wordBox) throw new Error("code line not measured");
  await page.mouse.dblclick(wordBox.x + 60, wordBox.y + wordBox.height / 2);
  const selected = await page.evaluate(() => getSelection()?.toString() ?? "");
  expect(selected.length).toBeGreaterThan(0);
  expect(selected.length).toBeLessThan("console.log(标题);".length);

  // 选中超长单词时，底层选区矩形仍会超出卡片；选区层必须被裁到阅读列内，
  // 同时用代码文本装饰在卡片内显示可见高亮。
  const longLine = page.locator(".cm-line.cm-sr-codeblock-body").filter({ hasText: "verylongunbrokenstring" }).first();
  const longBox = await longLine.boundingBox();
  if (!longBox) throw new Error("long code line not measured");
  await page.mouse.dblclick(longBox.x + 80, longBox.y + longBox.height / 2);
  await expect(page.locator(".cm-sr-code-selection").first()).toBeVisible();
  const layout = await page.evaluate(() => {
    const layer = document.querySelector(".cm-selectionLayer");
    const card = document.querySelector(".cm-sr-codeblock-header");
    const background = document.querySelector(".cm-selectionBackground");
    if (!layer || !card || !background) return null;
    const layerRect = layer.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const backgroundRect = background.getBoundingClientRect();
    return {
      clipPath: getComputedStyle(layer).clipPath,
      layerLeft: layerRect.left,
      layerRight: layerRect.right,
      cardLeft: cardRect.left,
      cardRight: cardRect.right,
      backgroundRight: backgroundRect.right,
    };
  });
  if (!layout) throw new Error("selection layers not found");
  expect(layout.clipPath).not.toBe("none");
  expect(layout.cardLeft).toBeGreaterThanOrEqual(layout.layerLeft);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.layerRight);
  // 回归条件：没有裁切时，这段超长选区确实会画到卡片右侧。
  expect(layout.backgroundRight).toBeGreaterThan(layout.cardRight);
});

test("Soft render code block background click enters editing with a normal caret", async ({ page }) => {
  const twoBlocks = "## 一\n\n" + fence + "\nfirst();\n" + fence + "\n\n## 二\n\n" + fence + "\nsecond();\n" + fence + "\n";
  await openWorkspace(page, state("code-background.md", twoBlocks));
  await page.getByRole("button", { name: "code-background", exact: true }).first().click();
  const widgets = page.locator(".cm-sr-codeblock-widget");
  await expect(widgets).toHaveCount(2);

  const firstHeader = await widgets.first().locator(".cm-sr-codeblock-header").boundingBox();
  if (!firstHeader) throw new Error("code block header not measured");
  await page.mouse.click(firstHeader.x + firstHeader.width * 0.55, firstHeader.y + firstHeader.height / 2);
  await expect(widgets).toHaveCount(1);

  const secondCard = await widgets.first().boundingBox();
  const secondBody = await widgets.first().locator("pre").boundingBox();
  if (!secondCard || !secondBody) throw new Error("code block not measured");
  await page.mouse.click(secondCard.x + secondCard.width + 10, secondBody.y + secondBody.height / 2);
  // 点击第二个块后它进入编辑，第一个块退出编辑并重新渲染成 widget。
  await expect(widgets).toHaveCount(1);
  const caretHeight = await page.locator(".cm-cursor-primary").first().evaluate((el) => el.getBoundingClientRect().height);
  // 点击块边界曾把光标高度设成整张卡片；进入正文后应回到代码行高。
  expect(caretHeight).toBeGreaterThan(0);
  expect(caretHeight).toBeLessThan(40);
});

test("Soft render code block gutter clicks never create a block-height caret", async ({ page }) => {
  const twoBlocks = "## 一\n\n" + fence + "\nfirst();\n" + fence + "\n\n## 二\n\n" + fence + "\nsecond();\n" + fence + "\n";
  await openWorkspace(page, state("code-gutter.md", twoBlocks));
  await page.getByRole("button", { name: "code-gutter", exact: true }).first().click();
  const widgets = page.locator(".cm-sr-codeblock-widget");
  await expect(widgets).toHaveCount(2);

  const firstCard = await widgets.first().boundingBox();
  const content = await page.locator(".cm-content").boundingBox();
  if (!firstCard || !content) throw new Error("layout not measured");
  // 阅读列右侧是 CodeMirror 的空白 gutter；旧实现会把光标落到替换 widget 边界。
  await page.mouse.click(content.x + content.width + 20, firstCard.y + firstCard.height / 2);
  await expect(widgets).toHaveCount(1);
  let caretHeight = await page.locator(".cm-cursor-primary").first().evaluate((el) => el.getBoundingClientRect().height);
  expect(caretHeight).toBeGreaterThan(0);
  expect(caretHeight).toBeLessThan(40);

  const header = await page.locator(".cm-sr-codeblock-header").first().boundingBox();
  if (!header) throw new Error("editing header not measured");
  await page.mouse.click(content.x + content.width + 20, header.y + header.height / 2);
  caretHeight = await page.locator(".cm-cursor-primary").first().evaluate((el) => el.getBoundingClientRect().height);
  expect(caretHeight).toBeGreaterThan(0);
  expect(caretHeight).toBeLessThan(40);
});

test("Soft render code block uses the preview block gap around the card", async ({ page }) => {
  const shortCode = "前面一段\n\n" + fence + "\nfirst();\n" + fence + "\n\n中间一段\n" + fence + "\nsecond();\n" + fence + "\n后面一段\n";
  await openWorkspace(page, state("code-gap.md", shortCode));
  await page.getByRole("button", { name: "code-gap", exact: true }).first().click();
  const cards = page.locator(".cm-sr-codeblock-widget");
  await expect(cards).toHaveCount(2);

  // 第一块前有空行、第二块前后都紧贴正文；两种源码写法都必须得到同一 12px 间距。
  const renderedGaps = await page.evaluate(() => {
    return [...document.querySelectorAll(".cm-sr-codeblock-widget")].map((card) => {
      return {
        beforePadding: card.previousElementSibling ? Number.parseFloat(getComputedStyle(card.previousElementSibling).paddingBottom) : 0,
        afterPadding: card.nextElementSibling ? Number.parseFloat(getComputedStyle(card.nextElementSibling).paddingTop) : 0,
        marginTop: Number.parseFloat(getComputedStyle(card).marginBlockStart),
        marginBottom: Number.parseFloat(getComputedStyle(card).marginBlockEnd),
      };
    });
  });
  for (const gap of renderedGaps) {
    expect(gap.beforePadding).toBeCloseTo(12, 0);
    expect(gap.afterPadding).toBeCloseTo(12, 0);
    expect(gap.marginTop).toBeCloseTo(0, 0);
    expect(gap.marginBottom).toBeCloseTo(0, 0);
  }

  await cards.first().locator("pre").click();
  const activeGap = await page.evaluate(() => {
    const header = document.querySelector(".cm-sr-codeblock-header");
    const footer = document.querySelector(".cm-sr-codeblock-footer");
    if (!header || !footer) return null;
    return {
      beforePadding: header.previousElementSibling ? Number.parseFloat(getComputedStyle(header.previousElementSibling).paddingBottom) : 0,
      afterPadding: footer.nextElementSibling ? Number.parseFloat(getComputedStyle(footer.nextElementSibling).paddingTop) : 0,
      headerMargin: Number.parseFloat(getComputedStyle(header).marginBlockStart),
      footerMargin: Number.parseFloat(getComputedStyle(footer).marginBlockEnd),
    };
  });
  if (!activeGap) throw new Error("active code block not measured");
  expect(activeGap.beforePadding).toBeCloseTo(12, 0);
  expect(activeGap.afterPadding).toBeCloseTo(12, 0);
  expect(activeGap.headerMargin).toBeCloseTo(0, 0);
  expect(activeGap.footerMargin).toBeCloseTo(0, 0);
});

test("Soft render code block language and collapse controls stay inside the card", async ({ page }) => {
  await openWorkspace(page, state("card-controls.md", "before\n\n" + fence + "typescript\nconst a = 1;\n" + fence + "\n\nafter\n"));
  await page.getByRole("button", { name: "card-controls", exact: true }).first().click();
  const block = page.locator(".cm-sr-codeblock-widget").first();
  await expect(block).toBeVisible();
  await block.locator("pre").click();
  const header = page.locator(".cm-sr-codeblock-header");
  await expect(header.locator("select")).toHaveValue("typescript");
  await header.locator("select").focus();
  await expect(header.locator("select")).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
  await expect(header.locator("select")).toHaveCSS("outline-style", "none");
  await expect(header.locator("select")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await header.locator("select").selectOption("rust");
  await expect(header.locator("select")).toHaveValue("rust");
  await expect(page.locator(".cm-sr-codeblock-body")).toContainText("const a = 1;");
  await page.getByRole("button", { name: "收起代码块" }).click();
  await expect(page.locator(".cm-sr-codeblock-widget")).toBeVisible();
  await expect(page.locator(".cm-sr-codeblock-body")).toHaveCount(0);
  await page.getByRole("tab", { name: "源码" }).click();
  await expect(page.locator(".cm-content")).toContainText(fence + "rust");
  await expect(page.locator(".cm-content")).toContainText("const a = 1;");
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

  test("软渲染聚焦代码块不自动换行", async ({ page }) => {
    await openWorkspace(page, state("mobile-edit-code.md", markdown));
    await page.getByRole("button", { name: "mobile-edit-code", exact: true }).first().click();
    const block = page.locator(".cm-sr-codeblock-widget").first();
    await expect(block).toBeVisible();
    await expect(block.locator(".note-code-scrollbar")).toHaveCSS("opacity", "0");
    await block.locator("pre").click();
    await expect(page.locator(".cm-sr-codeblock-footer-track")).toHaveCSS("opacity", "1");
    const focusedCode = page.locator(".cm-line").filter({ hasText: "verylongunbrokenstring" }).first();
    await expect(focusedCode).toHaveCSS("white-space", "pre");
    const metrics = await focusedCode.evaluate((el) => {
      el.scrollLeft = 60;
      return { height: el.getBoundingClientRect().height, scrollLeft: el.scrollLeft };
    });
    expect(metrics.height).toBeLessThan(40);
    expect(metrics.scrollLeft).toBeGreaterThan(0);
    // 长代码行只在卡片内横滚，不能把编辑器 / 顶栏撑出移动端视口。
    const layout = await page.locator(".cm-sr-codeblock-header").evaluate((header) => {
      const rect = header.getBoundingClientRect();
      const content = document.querySelector(".cm-content")?.getBoundingClientRect();
      return {
        headerRight: rect.right,
        contentRight: content?.right ?? 0,
        viewport: window.innerWidth,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(layout.headerRight).toBeLessThanOrEqual(layout.contentRight + 1);
    expect(layout.contentRight).toBeLessThanOrEqual(layout.viewport);
    expect(layout.docOverflow).toBeLessThanOrEqual(0);

    const content = await page.locator(".cm-content").boundingBox();
    const header = await page.locator(".cm-sr-codeblock-header").first().boundingBox();
    if (!content || !header) throw new Error("mobile code block not measured");
    await page.mouse.click(content.x + content.width + 8, header.y + header.height / 2);
    const caretHeight = await page.locator(".cm-cursor-primary").first().evaluate((el) => el.getBoundingClientRect().height);
    expect(caretHeight).toBeGreaterThan(0);
    expect(caretHeight).toBeLessThan(40);
  });
});
