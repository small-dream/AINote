import { expect, test, type Locator, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

const CONTENT = "# 一级标题\n\n#### 四级标题\n";

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
      await expect(page.getByRole("menuitem", { name: "六级标题" })).toBeVisible();
      await page.getByRole("menuitem", { name: "六级标题" }).click();

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
