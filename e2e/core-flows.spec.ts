import { expect, test, type Page } from "@playwright/test";
import { E2E_REPOS } from "../src/e2e/fixtures";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function baseState(notes: E2eState["notes"]): E2eState {
  return { repoPath: "/mock-repo", notes };
}

/** 单仓库种子：此时侧栏不应再渲染仓库标识行。 */
function singleRepoState(notes: E2eState["notes"]): E2eState {
  return { ...baseState(notes), repos: E2E_REPOS.slice(0, 1) };
}

/** 侧栏顶部到目录工具栏搜索框的距离：有仓库标识行时约 68px，没有时贴顶（约 15px）。 */
async function sidebarTopOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const sidebar = document.querySelector(".workspace-sidebar");
    const search = document.querySelector(".tree-search-input");
    if (!sidebar || !search) return -1;
    return search.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
  });
}

/** 断言侧栏顶部没有仓库标识行：首行即目录工具栏，且工具栏贴顶。 */
async function expectSidebarStartsAtTreeToolbar(page: Page): Promise<void> {
  await expect(page.locator(".workspace-sidebar > *").first().locator(".tree-search-input")).toBeVisible();
  const offset = await sidebarTopOffset(page);
  expect(offset).toBeGreaterThan(0);
  expect(offset).toBeLessThan(20);
}

test.describe("AINote 桌面核心流程", () => {
  test("导航轨：「笔记」是同步按钮之后的第一个入口", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "first.md", content: "# 第一篇" }]));
    const labels = await page
      .locator(".workspace-nav-rail button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    expect(labels.slice(0, 3)).toEqual(["立即同步", "笔记", "最近"]);
  });

  test("导航轨：组内间距 6px、分组间距 12px", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "first.md", content: "# 第一篇" }]));
    const gaps = await page.locator(".workspace-nav-rail button").evaluateAll((nodes) => {
      const rects = nodes.map((node) => node.getBoundingClientRect());
      const out: number[] = [];
      // 末位「设置」由 mt-auto 顶到底部，间距不参与比较
      for (let index = 0; index < rects.length - 2; index++) {
        const current = rects[index];
        const next = rects[index + 1];
        if (current && next) out.push(Math.round(next.top - current.bottom));
      }
      return out;
    });
    // 同步 | 笔记/最近/收藏/标签/回收站 | 提交版本/Git 历史
    expect(gaps).toEqual([12, 6, 6, 6, 6, 12, 6]);
  });

  test("目录树顶部常驻显示当前仓库并可展开切换菜单", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "first.md", content: "# 第一篇" }]));

    const switcher = page.getByRole("button", { name: "切换仓库" });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText("Mock Repo");
    await expect(switcher).toContainText("GitHub");

    await switcher.click();
    const menu = page.getByRole("listbox", { name: "笔记仓库" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option", { selected: true })).toContainText("Mock Repo");
    await expect(menu.getByText("管理仓库…")).toBeVisible();
  });

  test("只绑定一个仓库时不渲染仓库标识行，目录工具栏上移到侧栏顶部", async ({ page }) => {
    await openWorkspace(page, singleRepoState([{ path: "solo.md", content: "# 唯一仓库" }]));

    await expect(page.getByRole("button", { name: "切换仓库" })).toHaveCount(0);
    await expectSidebarStartsAtTreeToolbar(page);
  });

  test("最近面板：清空按钮与面板标题垂直居中对齐", async ({ page }) => {
    await openWorkspace(page, baseState([
      { path: "a.md", content: "# A" },
      { path: "b.md", content: "# B" },
    ]));
    await page.getByRole("button", { name: "最近" }).first().click();
    const header = page.locator("header", { has: page.getByRole("button", { name: "清空" }) });
    await expect(header).toBeVisible();
    const centers = await header.evaluate((node) => {
      const textCenter = (el: Element | null) => {
        const range = document.createRange();
        range.selectNodeContents(el as Node);
        const rect = range.getBoundingClientRect();
        return (rect.top + rect.bottom) / 2;
      };
      return {
        title: textCenter(node.querySelector("span")),
        label: textCenter(node.querySelector("button span")),
        labelFontSize: getComputedStyle(node.querySelector("button span") as Element).fontSize,
      };
    });
    expect(centers.labelFontSize).toBe("11px");
    expect(Math.abs(centers.title - centers.label)).toBeLessThan(1.5);
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

  test("自动保存：变更后 3s 内自动写盘并回到已保存状态", async ({ page }) => {
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

  test("窄屏目录树顶部同样可看到、展开并切换仓库", async ({ page }) => {
    await openWorkspace(page, baseState([{ path: "mobile.md", content: "# 移动端" }]));

    const switcher = page.getByRole("button", { name: "切换仓库" });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText("Mock Repo");

    await switcher.click();
    const menu = page.getByRole("listbox", { name: "笔记仓库" });
    await expect(menu).toBeVisible();

    // 窄屏下列表项必须有可点击的触控高度（≥36px，与移动端 tab 一致）
    const optionHeight = await menu.getByRole("option", { name: /备份库/ }).evaluate((el) => el.getBoundingClientRect().height);
    expect(optionHeight).toBeGreaterThanOrEqual(36);

    await menu.getByRole("option", { name: /备份库/ }).click();
    await expect(switcher).toContainText("备份库");
    await expect(switcher).toContainText("Gitee");
    await expect(page.getByText("全部笔记").first()).toBeVisible();
  });

  test("窄屏单仓库时也不渲染仓库标识行，列表首行即目录工具栏", async ({ page }) => {
    await openWorkspace(page, singleRepoState([{ path: "mobile.md", content: "# 移动端" }]));

    await expect(page.getByRole("button", { name: "切换仓库" })).toHaveCount(0);
    await expectSidebarStartsAtTreeToolbar(page);
  });

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
