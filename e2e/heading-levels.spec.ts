import { expect, test, type Locator, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

const CONTENT = "# 一级标题\n\n#### 四级标题\n";
const ADJACENT_HEADING_CASES = [
  { label: "紧接", content: "# 一级标题\n## 二级标题\n\n正文\n" },
  { label: "隔空行", content: "# 一级标题\n\n## 二级标题\n\n正文\n" },
] as const;
const HEADING_BODY_CASES = [
  { label: "紧贴", content: "# 分组统计数量\n统计成功失败数量\n" },
  { label: "隔空行", content: "# 分组统计数量\n\n统计成功失败数量\n" },
] as const;

/** 当前可见编辑器的标题级别下拉按钮（桌面与移动壳可能同时在 DOM 里挂载编辑器）。 */
function visibleTrigger(page: Page): Locator {
  return page.locator('button[aria-label="标题级别"]:visible').first();
}

/** H4 所在行；x=20 落在行内文字上（点行尾空白不会移动光标）。 */
function line(page: Page, text: string): Locator {
  return page.locator(".cm-content:visible").first().locator(".cm-line").filter({ hasText: text }).first();
}

async function openHeadingNote(page: Page): Promise<void> {
  await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "heading.md", content: CONTENT }] });
  await openNote(page, "heading", "一级标题");
}

async function openAdjacentHeadingNote(page: Page, content: string): Promise<void> {
  await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "heading-spacing.md", content }] });
  await openNote(page, "heading-spacing", "一级标题");
}

async function openHeadingBodyNote(page: Page, content: string): Promise<void> {
  await openWorkspace(page, { repoPath: "/mock-repo", notes: [{ path: "heading-body.md", content }] });
  await openNote(page, "heading-body", "分组统计数量");
}

/** 桌面与移动共用编辑工具栏，按两种视口各跑一次，覆盖两个壳。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：标题级别 H1–H6`, () => {
    test.use({ viewport });

    test("下拉提供正文与 H1–H6，H4 正确回显并可改为 H6 落盘", async ({ page }) => {
      await openHeadingNote(page);

      // 光标落在已有的 `####` 段落里：工具栏回显 H4，而不是退回正文
      await line(page, "四级标题").click({ position: { x: 20, y: 8 } });
      await expect(visibleTrigger(page)).toHaveText("H4");

      await visibleTrigger(page).click();
      const menu = page.locator("ul").filter({ has: page.getByRole("button", { name: "H6", exact: true }) });
      await expect(menu.getByRole("button")).toHaveText(["正文", "H1", "H2", "H3", "H4", "H5", "H6"]);

      await page.getByRole("button", { name: "H6", exact: true }).click();

      // 落盘内容保持纯 Markdown：四级标题升为 `######`
      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain("###### 四级标题");

      // H6 生效后重新落光标：工具栏应回显 H6（H4–H6 判定回归）
      await line(page, "四级标题").click({ position: { x: 20, y: 8 } });
      await expect(visibleTrigger(page)).toHaveText("H6");
    });

    test("切到预览再回写作：光标停在原处，标题级别不跳成首行 H1", async ({ page }) => {
      await openHeadingNote(page);
      await line(page, "四级标题").click({ position: { x: 20, y: 8 } });
      await expect(visibleTrigger(page)).toHaveText("H4");

      await page.getByRole("tab", { name: "预览" }).click();
      await page.getByRole("tab", { name: "写作" }).click();

      // 编辑器重建后光标应回到 H4 段落，而不是默认落到文档开头的 H1
      await expect(visibleTrigger(page)).toHaveText("H4");
      await expect(page.locator(".editor-status-bar:visible").first()).toContainText("第 3 行");
    });

    for (const pair of ADJACENT_HEADING_CASES) test(`H1 与${pair.label}的 H2 间距和预览一致`, async ({ page }) => {
      await openAdjacentHeadingNote(page, pair.content);

      const softGap = await page.locator(".cm-content:visible").first().evaluate((root) => {
        const h1 = root.querySelector<HTMLElement>(".cm-sr-h1");
        const h2 = root.querySelector<HTMLElement>(".cm-sr-h2");
        if (!h1 || !h2) return null;
        const textRect = (element: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect();
        };
        return textRect(h2).top - textRect(h1).bottom;
      });
      await page.getByRole("tab", { name: "预览" }).click();
      const previewGap = await page.locator(".markdown-body:visible").first().evaluate((root) => {
        const h1 = root.querySelector<HTMLElement>("h1");
        const h2 = root.querySelector<HTMLElement>("h2");
        if (!h1 || !h2) return null;
        const textRect = (element: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect();
        };
        return textRect(h2).top - textRect(h1).bottom;
      });

      if (softGap === null || previewGap === null) throw new Error("未找到可测量的 H1/H2 标题");
      const tolerance = name === "桌面端" ? 1 : 3.5;
      expect(Math.abs(softGap - previewGap), `写作 ${softGap}px / 预览 ${previewGap}px`).toBeLessThanOrEqual(tolerance);
    });

    for (const bodyCase of HEADING_BODY_CASES) test(`H1 与${bodyCase.label}正文的间距和预览一致`, async ({ page }) => {
      await openHeadingBodyNote(page, bodyCase.content);

      const softGap = await page.locator(".cm-content:visible").first().evaluate((root) => {
        const heading = root.querySelector<HTMLElement>(".cm-sr-h1");
        const body = [...root.querySelectorAll<HTMLElement>(".cm-line")].find((line) => line.textContent?.includes("统计成功失败数量"));
        if (!heading || !body) return null;
        const textRect = (element: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect();
        };
        return textRect(body).top - textRect(heading).bottom;
      });

      await page.getByRole("tab", { name: "预览" }).click();
      const previewGap = await page.locator(".markdown-body:visible").first().evaluate((root) => {
        const heading = root.querySelector<HTMLElement>("h1");
        const body = root.querySelector<HTMLElement>("p");
        if (!heading || !body) return null;
        const textRect = (element: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect();
        };
        return textRect(body).top - textRect(heading).bottom;
      });

      if (softGap === null || previewGap === null) throw new Error("未找到可测量的 H1/正文");
      // 移动端编辑区为避免 iOS 聚焦缩放会把正文抬到 16px，而预览仍是 15px，
      // 同比例间距会多约 3px；规则本身的桌面端差值应在 1px 内。
      const tolerance = name === "桌面端" ? 1 : 3.5;
      expect(Math.abs(softGap - previewGap), `写作 ${softGap}px / 预览 ${previewGap}px`).toBeLessThanOrEqual(tolerance);
    });
  });
}

/** 富文本笔记：段落类型选择器同样开放到 H1–H6（与 Markdown 链路口径一致）。 */
function richTextState(level: number): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "heading", attrs: { level }, content: [{ type: "text", text: "富文本标题" }] }],
        }),
      },
    ],
  };
}

async function openRichText(page: Page, level: number): Promise<void> {
  await openWorkspace(page, richTextState(level));
  await page.getByRole("button", { name: "rich", exact: true }).first().click();
  await expect(page.locator(".ProseMirror").first()).toContainText("富文本标题", { timeout: 15_000 });
}

for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：富文本标题级别 H1–H6`, () => {
    test.use({ viewport });

    test("H4 回显为四级标题，并可改为 H6 落盘", async ({ page }) => {
      await openRichText(page, 4);

      await page.locator(".ProseMirror h4").first().click({ position: { x: 20, y: 8 } });
      const trigger = page.locator('button[aria-label="标题级别"]:visible').first();
      await expect(trigger).toHaveText("H4");

      await trigger.click();
      // 标题级别是「多选一」：菜单项语义为 menuitemradio（aria-checked 表达当前级别）
      const h6 = page.getByRole("menuitemradio", { name: "六级标题" });
      await expect(h6).toBeVisible();
      await h6.click();

      await expect(page.locator(".ProseMirror h6")).toHaveText("富文本标题");
      await expect(trigger).toHaveText("H6");

      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain('"level":6');
    });
  });
}
