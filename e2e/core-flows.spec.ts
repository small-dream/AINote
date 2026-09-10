import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function baseState(notes: E2eState["notes"]): E2eState {
  return { repoPath: "/mock-repo", notes };
}

test.describe("AINote 桌面核心流程", () => {
  test("导航轨：「笔记」是同步按钮之后的第一个入口", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "first.md", content: "# 第一篇" }]));
    const labels = await page
      .locator(".workspace-nav-rail button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    expect(labels.slice(0, 3)).toEqual(["立即同步", "笔记", "最近"]);
  });

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

  test("分栏选择：拖选编辑区文本后保留选区", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "select.md", content: "# 选择测试\n\n这是一段用于验证拖选的文本内容。\n" }]));
    await openNote(page, "select", "选择测试");
    await page.getByRole("tab", { name: "分栏" }).click();
    const content = page.locator(".cm-content").first();
    await expect(content).toContainText("这是一段用于验证拖选的文本内容", { timeout: 15_000 });
    const line = page.locator(".cm-line").filter({ hasText: "这是一段用于验证拖选的文本内容" }).first();
    const box = await line.boundingBox();
    if (!box) throw new Error("编辑器未渲染");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.min(box.width - 4, 200), y, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator(".cm-selectionBackground").first()).toBeAttached();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toContain("这是一段");
    // 回归：分栏（源码）模式开启 highlightActiveLine，其不透明背景会盖住 CodeMirror 内联的 z-index:-1 选区层，
    // 造成「已选中但看不见」。选区层必须被提升到活动行之上。
    const selectionLayerZ = await page.locator(".cm-selectionLayer").first().evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(selectionLayerZ)).toBeGreaterThan(0);
  });
});

test.describe("AINote 移动端窄屏", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("窄屏用「源码」替代「分栏」并切换为全宽源码编辑", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "mobile.md", content: "# 移动端\n\n移动端正文内容" }]));
    await openNote(page, "mobile", "移动端正文内容");
    await expect(page.getByRole("tab", { name: "源码" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "分栏" })).toHaveCount(0);
    await expect(page.locator(".cm-gutters")).toHaveCount(0);
    await page.getByRole("tab", { name: "源码" }).click();
    await expect(page.locator(".cm-gutters").first()).toBeVisible();
  });
});
