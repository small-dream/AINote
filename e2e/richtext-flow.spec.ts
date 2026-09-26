import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function richTextState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "选中这段文字加链接" }] }],
        }),
      },
    ],
  };
}

/** 两段纯文本：格式刷用例需要在同一篇里「复制源格式 → 刷到另一段」。 */
function twoParagraphState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "格式源" }] },
            { type: "paragraph", content: [{ type: "text", text: "格式目标" }] },
          ],
        }),
      },
    ],
  };
}

/** 单个空任务项：验证「复选框右侧点得进去、输得了字」。 */
function emptyTaskState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [
            { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }] },
          ],
        }),
      },
    ],
  };
}

/** 旧版 / 手改过的 .ainote 里列表可能没有 tight 属性：加载时会被规范化，内容与编辑器
 *  内建 JSON 不一致，曾让 effect 在已销毁的实例上调用 commands 而整页白屏。 */
function looseListState(): E2eState {
  return {
    repoPath: "/mock-repo",
    notes: [
      {
        path: "rich.ainote",
        kind: "richText",
        content: JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "发布清单" }] },
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "无序一" }] }] },
                { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "无序二" }] }] },
              ],
            },
          ],
        }),
      },
    ],
  };
}

test.describe("富文本编辑器", () => {
  test("打开富文本笔记正常渲染,不崩溃", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    await expect(page.locator(".ProseMirror").first()).toContainText("选中这段文字加链接", { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("Mod-k 打开链接输入,裸域名自动补全协议并写入文档", async ({ page }) => {
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    await page.locator(".ProseMirror").first().click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+k");

    const input = page.locator('div[role="dialog"][aria-label="链接"] input');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("example.com");
    await page.keyboard.press("Enter");

    const link = page.locator(".ProseMirror a.link-mark");
    await expect(link).toHaveAttribute("href", "https://example.com");
    await expect(link).toContainText("选中这段文字加链接");
  });
});

/** 字符级样式（字体 / 字号 / 颜色 / 高亮）：桌面与移动共用同一套工具栏与面板。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：富文本字符样式`, () => {
    test.use({ viewport });

    test("设置高亮与颜色后落盘 JSON 带枚举 mark，且不含行内 style", async ({ page }) => {
      await openWorkspace(page, richTextState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
      await prose.click();
      await page.keyboard.press("ControlOrMeta+a");

      // 「Aa」面板：高亮与颜色两组
      await page.getByRole("button", { name: "文本样式" }).first().click();
      const panel = page.locator('div[role="dialog"][aria-label="文本样式"]');
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: "黄色高亮" }).click();
      await panel.getByRole("button", { name: "危险色" }).click();

      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);
      await expect(prose.locator("span.rt-fg-danger")).toHaveCount(1);
      // 生产壳的 CSP 会拦掉行内 style，绝不允许出现在文档里
      expect(await prose.innerHTML()).not.toMatch(/style=/);

      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain('"markStyle"');
    });

    test("再次点击同一档位取消样式", async ({ page }) => {
      await openWorkspace(page, richTextState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
      await prose.click();
      await page.keyboard.press("ControlOrMeta+a");

      await page.getByRole("button", { name: "文本样式" }).first().click();
      const panel = page.locator('div[role="dialog"][aria-label="文本样式"]');
      const yellow = panel.getByRole("button", { name: "黄色高亮" });
      await yellow.click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);
      await yellow.click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(0);
    });
  });
}

/** 选区气泡菜单提供高亮与颜色两个高频动作（与工具栏面板共用实现）。 */
test.describe("富文本气泡菜单字符样式", () => {
  test("选中文字后可直接设置高亮", async ({ page }) => {
    await openWorkspace(page, richTextState());
    await page.getByRole("button", { name: "rich", exact: true }).first().click();
    const prose = page.locator(".ProseMirror").first();
    await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });
    await prose.click();
    await page.keyboard.press("ControlOrMeta+a");

    await page.getByRole("button", { name: "高亮" }).first().click();
    const menu = page.locator('div[role="dialog"][aria-label="高亮"]');
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "蓝色高亮" }).click();
    await expect(prose.locator("mark.rt-mark-blue")).toHaveCount(1);
  });
});

/** 光标落入某一段后按 Shift+Home 选中整段：富文本里的双击由 ProseMirror 接管，选不出词。 */
async function selectParagraph(page: Page, text: string): Promise<void> {
  await page.locator(".ProseMirror").first().getByText(text, { exact: true }).click();
  await page.keyboard.press("Shift+Home");
}

/** 任务列表 / 格式刷 / 清除格式：桌面与移动共用同一套工具栏实现。 */
for (const { name, viewport } of [
  { name: "桌面端", viewport: { width: 1280, height: 900 } },
  { name: "移动端", viewport: { width: 402, height: 874 } },
]) {
  test.describe(`${name}：富文本任务列表与格式清理`, () => {
    test.use({ viewport });

    test("缺 tight 属性的列表文档打开不白屏", async ({ page }) => {
      await openWorkspace(page, looseListState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose.locator("ul li")).toHaveCount(2, { timeout: 15_000 });
      await expect(prose).toContainText("无序一");
      await expect(page.getByText("Unexpected Application Error!")).toHaveCount(0);
    });

    test("空任务项整行可点：点复选框右侧即可输入", async ({ page }) => {
      await openWorkspace(page, emptyTaskState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      const item = prose.locator('ul[data-type="taskList"] > li').first();
      await expect(item).toBeVisible({ timeout: 15_000 });

      const row = await item.boundingBox();
      const paragraph = await item.locator("p").boundingBox();
      if (!row || !paragraph) throw new Error("任务项未渲染完整");
      // 空段落也要占满整行：否则复选框右侧是一片点不进去的死区（触摸端点了不出光标）
      expect(paragraph.width).toBeGreaterThan(row.width * 0.8);

      await page.mouse.click(row.x + row.width - 40, row.y + row.height / 2);
      await page.keyboard.type("买牛奶");
      await expect(item).toContainText("买牛奶");
    });

    test("切换为任务列表后勾选框与文本同排，勾选落盘 checked", async ({ page }) => {
      await openWorkspace(page, richTextState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("选中这段文字加链接", { timeout: 15_000 });

      await prose.click();
      await page.keyboard.press("ControlOrMeta+a");
      await page.getByRole("button", { name: "任务列表" }).first().click();

      // 编辑器里任务项由 NodeView 渲染：li 只有 data-checked，样式按「taskList 直系子项」命中
      const item = prose.locator('ul[data-type="taskList"] > li').first();
      await expect(item).toHaveAttribute("data-checked", "false");
      await expect(item).toHaveCSS("display", "flex");

      await item.locator('input[type="checkbox"]').click();
      await expect(item).toHaveAttribute("data-checked", "true");
      await expect(item.locator("div").first()).toHaveCSS("text-decoration-line", "line-through");

      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain('"checked":true');
    });

    test("格式刷把源选区的字符样式刷到目标选区", async ({ page }) => {
      await openWorkspace(page, twoParagraphState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("格式源", { timeout: 15_000 });

      await selectParagraph(page, "格式源");
      await page.getByRole("button", { name: "文本样式" }).first().click();
      await page.locator('div[role="dialog"][aria-label="文本样式"]').getByRole("button", { name: "黄色高亮" }).click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);

      // 单击格式刷进入待刷态（按钮名切换为提示文案），随后选中目标文本即自动套用
      await page.getByRole("button", { name: "格式刷" }).click();
      await expect(page.getByRole("button", { name: "已复制格式，选中目标文本即可应用" })).toBeVisible();

      await selectParagraph(page, "格式目标");
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(2);
      await expect(page.getByRole("button", { name: "格式刷" })).toBeVisible();

      await expect
        .poll(async () => {
          const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
          return String(updates.at(-1)?.args.content ?? "");
        }, { timeout: 10_000 })
        .toContain('"markStyle"');
    });

    test("清除格式去掉行内样式并回到正文", async ({ page }) => {
      await openWorkspace(page, twoParagraphState());
      await page.getByRole("button", { name: "rich", exact: true }).first().click();
      const prose = page.locator(".ProseMirror").first();
      await expect(prose).toContainText("格式源", { timeout: 15_000 });

      await selectParagraph(page, "格式源");
      await page.getByRole("button", { name: "文本样式" }).first().click();
      await page.locator('div[role="dialog"][aria-label="文本样式"]').getByRole("button", { name: "黄色高亮" }).click();
      await page.getByRole("button", { name: "加粗" }).first().click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(1);
      await expect(prose.locator("strong")).toHaveCount(1);

      await page.getByRole("button", { name: "清除格式" }).click();
      await expect(prose.locator("mark.rt-mark-yellow")).toHaveCount(0);
      await expect(prose.locator("strong")).toHaveCount(0);
    });
  });
}
