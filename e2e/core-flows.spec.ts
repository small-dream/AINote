import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function baseState(notes: E2eState["notes"]): E2eState {
  return { repoPath: "/mock-repo", notes };
}

test.describe("AINote 桌面核心流程", () => {
  test("切换笔记：点击目录树在笔记间切换并加载各自内容", async ({ page }) => {
    await openWorkspace(page, baseState([
      { path: "first.md", content: "# 第一篇\n\n这是第一份内容" },
      { path: "second.md", content: "# 第二篇\n\n另一份笔记内容" },
    ]));
    await openNote(page, "first", "这是第一份内容");
    await openNote(page, "second", "另一份笔记内容");
    await expect(page.locator(".cm-content").first()).not.toContainText("这是第一份内容");
  });

  test("自动保存：停止输入后 3s 自动写盘并回到已保存状态", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "auto.md", content: "# 自动保存\n" }]));
    await openNote(page, "auto", "自动保存");
    const editor = page.locator(".cm-content").first();
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type("草稿标记行");
    await expect(page.getByText("有未保存修改").first()).toBeVisible();
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 8_000 });
    const updates = (await calls(page)).filter((call) => call.cmd === "update_note");
    expect(updates.length).toBeGreaterThan(0);
    expect(String(updates.at(-1)?.args.content ?? "")).toContain("草稿标记行");
  });

  test("历史恢复：打开版本历史并恢复旧版本", async ({ page }) => {
    const state = baseState([{ path: "hist.md", content: "# 当前版\n\n最新内容" }]);
    state.versions = {
      "hist.md": [
        { path: "hist.md", id: "111", message: "第二版", content: "# 第二版\n\n旧内容" },
        { path: "hist.md", id: "222", message: "初始版", content: "# 初始版\n\n恢复目标" },
      ],
    };
    await openWorkspace(page, state);
    await openNote(page, "hist", "最新内容");
    await page.getByRole("button", { name: "版本历史" }).click();
    await page.getByRole("dialog", { name: "版本历史" }).waitFor();
    await page.getByRole("button", { name: "初始版" }).click();
    await page.getByRole("button", { name: "恢复此版本" }).click();
    await page.getByRole("button", { name: "确认恢复" }).click();
    await expect(page.locator(".cm-content").first()).toContainText("恢复目标", { timeout: 15_000 });
    await expect(page.locator(".cm-content").first()).not.toContainText("最新内容");
  });

  test("冲突恢复：存在冲突时一键保留本地并回到已同步", async ({ page }) => {
    const state = baseState([{ path: "conflict.md", content: "# 本地\n" }]);
    state.conflicted = true;
    state.conflicts = [{ path: "conflict.md", local: "# 本地\n", remote: "# 远端\n" }];
    await openWorkspace(page, state);
    const resolveButton = page.getByRole("button", { name: "解决同步冲突" });
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();
    await page.getByRole("button", { name: "全部保留本地" }).click();
    await expect(page.getByRole("button", { name: "全部保留本地" })).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "解决同步冲突" })).toBeHidden();
  });

  test("图片加载：预览模式加载仓库内图片为 data-uri 并成功渲染", async ({ page }) => {
    const state = baseState([{ path: "img.md", content: "# 图片\n\n![示例](assets/pic.png)" }]);
    state.assets = { "pic.png": PNG };
    await openWorkspace(page, state);
    await openNote(page, "img", "图片");
    await page.getByRole("tab", { name: "预览" }).click();
    const image = page.locator(".markdown-image img").first();
    await expect(image).toBeVisible({ timeout: 20_000 });
    await expect(image).toHaveAttribute("src", /^data:image\/png/);
    await page.waitForFunction(() => {
      const img = document.querySelector(".markdown-image img");
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
    });
    await expect(page.getByText("图片加载失败")).not.toBeVisible();
  });

  test("分栏同步：长笔记滚动编辑侧后预览侧同步滚动", async ({ page }) => {
    const lines = Array.from({ length: 60 }, (_, index) => `段落 ${index + 1}：用于制造足够滚动高度以验证双向同步。`).join("\n\n");
    await openWorkspace(page, baseState([{ path: "long.md", content: `# 长文\n\n${lines}` }]));
    await openNote(page, "long", "段落 1");
    await page.getByRole("tab", { name: "分栏" }).click();
    await expect(page.locator(".note-preview-pane .markdown-body").first()).toBeVisible({ timeout: 20_000 });
    const editorScroller = page.locator(".cm-scroller").first();
    const previewPane = page.locator(".note-preview-pane").first();
    await expect.poll(async () => previewPane.evaluate((el) => el.scrollHeight - el.clientHeight), { timeout: 10_000 }).toBeGreaterThan(50);
    await editorScroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect.poll(async () => previewPane.evaluate((el) => el.scrollTop), { timeout: 5_000 }).toBeGreaterThan(0);
  });
});
