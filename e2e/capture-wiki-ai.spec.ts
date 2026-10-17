import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { emitAppEvent, openNote, openWorkspace } from "./helpers";

function state(notes: E2eState["notes"], extra: Partial<E2eState> = {}): E2eState {
  return { repoPath: "/mock-repo", notes, ...extra };
}

async function openTool(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "更多" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test.describe("快速捕捉", () => {
  test("桌面快捷键事件打开捕获框，保存后关闭并可从提示打开笔记", async ({ page }) => {
    await openWorkspace(page, state([{ path: "first.md", content: "# 第一篇" }]));
    await emitAppEvent(page, "capture:open");

    const dialog = page.getByRole("dialog", { name: "快速捕捉" });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("记下想法…（首行将作为标题）").fill("第一行想法\n第二行正文");
    await dialog.getByPlaceholder("标签（逗号分隔，如 工作, 灵感）").fill("工作, 灵感");
    await dialog.getByRole("button", { name: "捕捉", exact: true }).click();

    await expect(page.getByText("已捕获")).toBeVisible();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "打开笔记" }).click();
    await expect(page.locator(".cm-content").first()).toContainText("第二行正文", { timeout: 15_000 });
  });

  test("保存失败时保留输入内容", async ({ page }) => {
    await openWorkspace(page, state([{ path: "first.md", content: "# 第一篇" }], { captureFailure: { message: "磁盘不可写" } }));
    await emitAppEvent(page, "capture:open");
    const dialog = page.getByRole("dialog", { name: "快速捕捉" });
    const input = dialog.getByPlaceholder("记下想法…（首行将作为标题）");
    await input.fill("失败也要保留");
    await dialog.getByRole("button", { name: "捕捉", exact: true }).click();

    await expect(dialog.getByText(/磁盘不可写|CAPTURE_10001/)).toBeVisible();
    await expect(input).toHaveValue("失败也要保留");
  });
});

test.describe("快速捕捉移动布局", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("390px 下捕获框不溢出并可保存", async ({ page }) => {
    await openWorkspace(page, state([{ path: "mobile.md", content: "# 移动端" }]));
    await emitAppEvent(page, "capture:open");
    const dialog = page.getByRole("dialog", { name: "快速捕捉" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    await dialog.getByPlaceholder("记下想法…（首行将作为标题）").fill("移动端的想法");
    await dialog.getByRole("button", { name: "捕捉", exact: true }).click();
    await expect(page.getByText("已捕获")).toBeVisible();
  });
});

const PLAN_NOTE = "---\ntitle: 项目计划\n---\n\n# 项目计划\n\n计划正文";

test.describe("双链 2.0", () => {
  test("逐条把未链接提及转为双链", async ({ page }) => {
    await openWorkspace(page, state([
      { path: "plan.md", content: PLAN_NOTE },
      { path: "source.md", content: "# 来源\n\n参考项目计划完成。" },
    ]));
    await openNote(page, "plan", "计划正文");
    await openTool(page, "双链与标签");

    const dialog = page.getByRole("dialog", { name: "双链与标签" });
    await expect(dialog.getByText("未链接提及")).toBeVisible();
    await dialog.getByRole("button", { name: "转为双链" }).click();
    await expect(dialog.getByText("没有未链接提及")).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();

    await openNote(page, "source", "参考");
    await expect(page.locator('.cm-sr-wikilink[data-sr-target="项目计划"]').first()).toBeVisible();
  });

  test("全部转换需要二次确认并一次处理多条来源", async ({ page }) => {
    await openWorkspace(page, state([
      { path: "plan.md", content: PLAN_NOTE },
      { path: "source-a.md", content: "# 来源 A\n\n项目计划要落地。" },
      { path: "source-b.md", content: "# 来源 B\n\n继续推进项目计划。" },
    ]));
    await openNote(page, "plan", "计划正文");
    await openTool(page, "双链与标签");
    const dialog = page.getByRole("dialog", { name: "双链与标签" });
    await dialog.getByRole("button", { name: "全部转换" }).click();
    await dialog.getByRole("button", { name: "确认全部转换" }).click();
    await expect(dialog.getByText("没有未链接提及")).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();

    await openNote(page, "source-a", "落地");
    await expect(page.locator('.cm-sr-wikilink[data-sr-target="项目计划"]').first()).toBeVisible();
    await openNote(page, "source-b", "推进");
    await expect(page.locator('.cm-sr-wikilink[data-sr-target="项目计划"]').first()).toBeVisible();
  });
});

test.describe("AI 带引用", () => {
  test("全库问答先展示引用芯片，点击后打开并定位目标笔记", async ({ page }) => {
    await openWorkspace(page, state([
      { path: "plan.md", content: PLAN_NOTE },
      { path: "ask.md", content: "# 问答\n\n项目计划下一步是什么？" },
    ]));
    await openNote(page, "ask", "下一步");
    await openTool(page, "AI");
    await page.getByRole("button", { name: "AI 问答" }).click();

    const panel = page.locator(".ai-ask-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "当前笔记 + 全库检索" }).click();
    await panel.getByPlaceholder("基于笔记提问，Enter 发送").fill("项目计划如何推进？");
    await panel.getByRole("button", { name: "发送" }).click();

    await expect(panel.getByText("已引用")).toBeVisible();
    await panel.locator('button[title="plan.md"]').click();
    await expect(page.locator(".cm-content").first()).toContainText("计划正文", { timeout: 15_000 });
  });
});
