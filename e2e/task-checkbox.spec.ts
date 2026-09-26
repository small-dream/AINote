import { expect, test, type Locator, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openWorkspace } from "./helpers";

/** 三个渲染面共用同一套勾选框绘制（styles/note-task-check.css）：
 *  富文本编辑器（TipTap NodeView）、Markdown 软渲染（CodeMirror widget）、只读预览（react-markdown）。
 *  这里比对真实 computed style，避免哪天只改其中一面。 */
function seed(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      { path: "plan.md", content: "# 发布清单\n\n- [ ] 写周报\n- [x] 发版本" },
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "发布清单" }] },
            {
              type: "taskList",
              content: [
                { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "写周报" }] }] },
                { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "发版本" }] }] },
              ],
            },
          ],
        }),
      },
    ],
  };
}

/** 移动壳打开笔记后目录会被笔记视图盖住，需要先「返回列表」；桌面端侧栏常驻，直接点即可。 */
async function openNote(page: Page, fileName: string): Promise<void> {
  const back = page.getByRole("button", { name: "返回列表" });
  if ((await back.count()) > 0 && (await back.first().isVisible())) await back.first().click();
  await page.getByRole("button", { name: fileName, exact: true }).first().click();
}

/** 勾选框尺寸 / 圆角 / 对勾都按 em 定义，因此随各表面的字号缩放（移动端可编辑区 16px、
 *  只读预览 15px），比较时先按字号归一化——要守的是「同一套绘制」，不是同一个绝对像素。 */
function draw(locator: Locator): Promise<Record<string, string | number>> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    return {
      appearance: style.appearance,
      borderTopWidth: style.borderTopWidth,
      borderTopColor: style.borderTopColor,
      sizeEm: Number((parseFloat(style.width) / fontSize).toFixed(3)),
      radiusEm: Number((parseFloat(style.borderRadius) / fontSize).toFixed(3)),
    };
  });
}

/** 勾选态：底色 + 对勾（::after 的边框即对勾本体）取色。
 *  对勾粗细不做断言：0.14em 在各表面会落到不同的设备像素上（2.1px / 2.24px），
 *  那属于渲染取整，不是绘制不一致。 */
function drawChecked(locator: Locator): Promise<Record<string, string | number>> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const tick = getComputedStyle(el, "::after");
    return {
      background: style.backgroundColor,
      tickColor: tick.borderTopColor,
    };
  });
}

for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：任务勾选框跨渲染面一致`, () => {
    test.use({ viewport });

    test("软渲染 / 只读预览 / 富文本编辑器用同一套勾选框绘制", async ({ page }) => {
      await openWorkspace(page, seed());

      // 富文本编辑器（TipTap TaskItem 的 NodeView）
      await openNote(page, "rich");
      const rich = page.locator('ul[data-type="taskList"] input[type="checkbox"]');
      await expect(rich.first()).toBeVisible({ timeout: 15_000 });
      const richDraw = await draw(rich.first());
      const richChecked = await drawChecked(rich.nth(1));
      // 自带绘制：不再走系统原生外观
      expect(richDraw.appearance).toBe("none");
      // 1.05em 见方、0.3em 圆角（token：--note-check-size）
      expect(richDraw.sizeEm).toBe(1.05);
      expect(richDraw.radiusEm).toBe(0.3);

      // Markdown 软渲染（CodeMirror widget）
      await openNote(page, "plan");
      const soft = page.locator(".cm-sr-checkbox");
      await expect(soft.first()).toBeVisible({ timeout: 15_000 });
      expect(await draw(soft.first())).toEqual(richDraw);
      expect(await drawChecked(soft.nth(1))).toEqual(richChecked);

      // 只读预览（react-markdown 的 input）
      await page.getByRole("tab", { name: "预览" }).click();
      const preview = page.locator('.markdown-body input[type="checkbox"]');
      await expect(preview.first()).toBeVisible();
      expect(await draw(preview.first())).toEqual(richDraw);
      expect(await drawChecked(preview.nth(1))).toEqual(richChecked);
    });

    test("预览里的任务项只留勾选框，不再重复显示列表圆点", async ({ page }) => {
      await openWorkspace(page, seed());
      await openNote(page, "plan");
      await expect(page.locator(".cm-content").first()).toContainText("写周报", { timeout: 15_000 });
      await page.getByRole("tab", { name: "预览" }).click();

      const item = page.locator(".markdown-body li.task-list-item").first();
      await expect(item).toBeVisible();
      await expect(item).toHaveCSS("list-style-type", "none");
    });
  });
}
