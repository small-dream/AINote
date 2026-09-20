import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "first.md", content: "# 第一篇" }] };
}

/** 预置一条「刚刚到点」的提醒任务：用于验证应用内提醒卡片（桌面 / 移动共用） */
function reminderState(): E2eState {
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const remindAt = new Date(Date.now() - 60_000).toISOString();
  return {
    ...baseState(),
    taskBoard: {
      schemaVersion: 3,
      tasks: [{
        id: "task-1",
        title: "交周报",
        description: "整理成本周进展三条",
        done: false,
        priority: "high",
        dueAt: `${day}T18:00`,
        remindAt,
        sortOrder: 0,
        createdAt: remindAt,
        updatedAt: remindAt,
        completedAt: null,
      }],
    },
  };
}

/** 读取元素的计算背景色（统一由浏览器归一化，避免手写色值）。 */
async function background(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().evaluate((node) => getComputedStyle(node).backgroundColor);
}

/** 预置阅读主题偏好；addInitScript 必须在 openWorkspace 之前调用。 */
async function presetNoteTheme(page: Page, noteTheme: string, scope: "content" | "workspace"): Promise<void> {
  await page.addInitScript((preset) => {
    localStorage.setItem("ainote.note-theme", preset.noteTheme);
    localStorage.setItem("ainote.note-theme-scope", preset.scope);
  }, { noteTheme, scope });
}

/**
 * 任务卡片同构断言：标题、详情、元数据 chips 必须落在同一张 `[data-task-form]` 卡片里，
 * 且自上而下是「标题 → 详情 → chips」（内容在上、元数据在下）。
 */
async function assertCardOrder(page: Page, density: "dialog" | "inline" | "pane"): Promise<void> {
  const card = page.locator(`[data-task-form="${density}"]`);
  const title = await card.getByLabel("任务标题").boundingBox();
  const detail = await card.getByRole("textbox", { name: "任务详情" }).boundingBox();
  const meta = await card.getByRole("button", { name: "设置截止日期" }).boundingBox();
  if (!title || !detail || !meta) throw new Error(`${density} 卡片未渲染完整`);
  expect(title.y + title.height).toBeLessThanOrEqual(detail.y + 1);
  expect(detail.y + detail.height).toBeLessThanOrEqual(meta.y + 1);
}

test.describe("Todo 待办（桌面壳）", () => {
  test("弹窗建任务 → 设置截止日期 → 勾选完成", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await expect(page.getByText("还没有待办任务")).toBeVisible();

    // 新建任务走弹窗：标题框自动聚焦，Enter 直接创建
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("写周报");
    await page.getByLabel("任务标题").press("Enter");
    const taskRow = page.getByRole("button", { name: /写周报/ });
    await expect(taskRow).toBeVisible();

    await taskRow.click();
    await page.getByRole("button", { name: "设置截止日期" }).click();
    await page.getByRole("button", { name: "明天" }).click();
    await page.getByRole("button", { name: "确认" }).click();
    await expect(taskRow).toContainText("明天");

    await page.getByRole("checkbox", { name: "写周报" }).click();
    // 勾选后任务移入默认折叠的「已完成」分组：任务行消失、分组计数变 1
    await expect(page.getByRole("button", { name: /已完成/ })).toContainText("1");

    const recorded = await calls(page);
    const commands = recorded.map((entry) => entry.cmd);
    expect(commands).toContain("task_create");
    expect(commands).toContain("task_update");
    expect(commands).toContain("task_toggle");
    expect(commands).not.toContain("task_create_list");
    const update = recorded.find((entry) => entry.cmd === "task_update");
    expect(String(update?.args.dueAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("阅读主题「内容与工作区」：待办工作区与目录侧栏同色", async ({ page }) => {
    await presetNoteTheme(page, "forest", "workspace");
    await openWorkspace(page, baseState());

    const treeBg = await background(page, ".workspace-sidebar");
    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.locator(".workspace-todo-list").waitFor();

    const listBg = await background(page, ".workspace-todo-list");
    expect(listBg).toBe(treeBg);
    // 未联动时侧栏底色为应用亮色 --bg-secondary
    expect(listBg).not.toBe("rgb(245, 247, 250)");
  });

  test("阅读主题「仅内容」：待办工作区保持应用主题配色", async ({ page }) => {
    await presetNoteTheme(page, "forest", "content");
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.locator(".workspace-todo-list").waitFor();

    expect(await background(page, ".workspace-todo-list")).toBe("rgb(245, 247, 250)");
  });

  test("弹窗内的截止时间面板完整可见，且浮在弹窗之上不被遮挡", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByRole("button", { name: "设置截止日期" }).click();

    const menu = page.getByRole("menu", { name: "设置截止日期" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "上个月" })).toBeVisible();

    const menuBox = await menu.boundingBox();
    const dialogBox = await page.getByRole("dialog").boundingBox();
    const viewport = page.viewportSize();
    if (!menuBox || !dialogBox) throw new Error("弹窗或日期菜单未渲染");
    // 面板可以溢出弹窗（避免压住弹窗底部操作区），但必须完整落在视口内
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport?.height ?? 0);
    // 水平方向仍在弹窗内收边
    expect(menuBox.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
    expect(await menu.evaluate((node) => getComputedStyle(node).zIndex)).toBe("80");
  });

  test("弹窗与桌面详情同卡同序：内容在上，元数据 chips 贴近底部操作栏", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();

    const dialog = page.getByRole("dialog", { name: "新建任务" });
    await assertCardOrder(page, "dialog");

    await dialog.getByLabel("任务标题").fill("写周报");
    const meta = await dialog.getByRole("button", { name: "设置截止日期" }).boundingBox();
    const actions = await dialog.getByRole("button", { name: "添加任务" }).boundingBox();
    if (!meta || !actions) throw new Error("新建任务弹窗未渲染完整");
    expect(meta.y + meta.height).toBeLessThanOrEqual(actions.y + 1);

    await dialog.getByRole("button", { name: "添加任务" }).click();

    // 点任务行 → 主区详情面板：同一张卡、同一顺序
    await page.getByRole("button", { name: /写周报/ }).click();
    await assertCardOrder(page, "pane");
  });

  test("详情改标题自动落盘并给出「已保存」，删除需要确认", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("写周报");
    await page.getByRole("button", { name: "添加任务" }).click();

    await page.getByRole("button", { name: /写周报/ }).click();
    await page.getByLabel("任务标题").fill("写周报（含数据）");
    // 不提供保存按钮，但保存结果必须自己出现在卡片底部
    await expect(page.getByRole("status")).toContainText("已保存");

    // 删除不再是单击即生效：取消后任务与改动都还在
    await page.getByRole("button", { name: "删除任务" }).click();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("button", { name: /写周报（含数据）/ })).toBeVisible();

    const update = (await calls(page)).find((entry) => entry.cmd === "task_update");
    expect(String(update?.args.title)).toBe("写周报（含数据）");
  });

  test("打开详情看完就返回：没有改动就不写盘，不制造待提交变更", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("交周报");
    await page.getByRole("button", { name: "添加任务" }).click();

    await page.getByRole("button", { name: /交周报/ }).click();
    const before = (await calls(page)).filter((entry) => entry.cmd === "task_update").length;

    // 点进标题再点「返回总览」会先触发失焦：这条路径曾经原样回传整份草稿并刷新 updated_at，
    // 让 todos.json 凭空多出一次变更，多端同步时表现成毫无意义的合并冲突
    await page.getByLabel("任务标题").click();
    await page.getByRole("button", { name: "返回总览" }).click();
    await page.waitForTimeout(400);

    const after = (await calls(page)).filter((entry) => entry.cmd === "task_update").length;
    expect(after).toBe(before);
  });

  test("日期与时间分两次选，时刻精确到分钟并存成带时刻的 dueAt", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("交周报");

    // 第一次：只选日期
    await page.getByRole("button", { name: "设置截止日期" }).click();
    await page.getByRole("button", { name: "明天" }).click();
    await page.getByRole("button", { name: "确认" }).click();
    // 日期 chip 已带上所选日期（时间仍未设置）
    await expect(page.getByRole("button", { name: "设置截止日期" })).toContainText("明天");
    await expect(page.getByRole("button", { name: "设置时间" })).toHaveText("时间");

    // 第二次：单独选具体时刻
    await page.getByRole("button", { name: "设置时间" }).click();
    await page.getByLabel("小时").getByRole("option", { name: "18", exact: true }).click();
    await page.getByLabel("分钟").getByRole("option", { name: "30", exact: true }).click();
    await page.getByRole("button", { name: "确认" }).click();

    await page.getByLabel("任务标题").press("Enter");
    // 任务行徽标同时显示日期与时刻
    await expect(page.getByRole("button", { name: /交周报/ })).toContainText("18:30");

    const recorded = await calls(page);
    const created = recorded.find((entry) => entry.cmd === "task_create");
    expect(String(created?.args.dueAt)).toMatch(/^\d{4}-\d{2}-\d{2}T18:30$/);
  });

  test("没选日期时不能单独设时间", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();

    await expect(page.getByRole("button", { name: "设置时间" })).toBeDisabled();

    await page.getByRole("button", { name: "设置截止日期" }).click();
    await page.getByRole("button", { name: "今天" }).click();
    await page.getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("button", { name: "设置时间" })).toBeEnabled();
  });

  test("提醒可选相对提前量，且随截止时间迁移", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("交周报");

    await page.getByRole("button", { name: "设置截止日期" }).click();
    await page.getByRole("button", { name: "明天" }).click();
    await page.getByRole("button", { name: "确认" }).click();
    await page.getByRole("button", { name: "设置时间" }).click();
    await page.getByLabel("小时").getByRole("option", { name: "18", exact: true }).click();
    await page.getByLabel("分钟").getByRole("option", { name: "00", exact: true }).click();
    await page.getByRole("button", { name: "确认" }).click();

    // 没设截止时间前提醒不可用
    await expect(page.getByRole("button", { name: "设置提醒" })).toBeEnabled();
    await page.getByRole("button", { name: "设置提醒" }).click();
    await page.getByRole("button", { name: "15 分钟前" }).click();
    await expect(page.getByRole("button", { name: "设置提醒" })).toHaveText("15 分钟前");
    await page.getByRole("button", { name: "确认" }).click();

    // 改截止日期后，相对提醒按同一提前量跟着迁移
    await page.getByRole("button", { name: "设置截止日期" }).click();
    await page.getByRole("button", { name: "后天" }).click();
    await page.getByRole("button", { name: "确认" }).click();
    await page.getByRole("button", { name: "添加任务" }).click();

    const created = (await calls(page)).find((entry) => entry.cmd === "task_create");
    const lead = (Date.parse(String(created?.args.dueAt)) - Date.parse(String(created?.args.remindAt))) / 60000;
    expect(lead).toBe(15);
  });

  test("标题里写「明天 18:00」直接识别出带时刻的截止时间", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("交周报 明天 18:00");
    await page.getByRole("button", { name: "添加任务" }).click();

    await expect(page.getByRole("button", { name: /交周报/ })).toContainText("18:00");
    const recorded = await calls(page);
    const created = recorded.find((entry) => entry.cmd === "task_create");
    expect(String(created?.args.dueAt)).toMatch(/^\d{4}-\d{2}-\d{2}T18:00$/);
  });

  test("到点提醒：桌面端弹出应用内提醒卡片，可稍后 10 分钟", async ({ page }) => {
    await openWorkspace(page, reminderState());

    const card = page.getByRole("alert").filter({ hasText: "交周报" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("截止 今天 18:00");
    await expect(card).toContainText("高");
    await expect(card).toContainText("整理成本周进展三条");

    await card.getByRole("button", { name: "稍后 10 分钟" }).click();
    await expect(card).toBeHidden();

    const update = (await calls(page)).find((entry) => entry.cmd === "task_update");
    const lead = Date.parse(String(update?.args.remindAt)) - Date.now();
    expect(lead).toBeGreaterThan(9 * 60_000);
    expect(lead).toBeLessThanOrEqual(10 * 60_000);
  });

  test("到点提醒：点「查看任务」回到待办并定位到该任务", async ({ page }) => {
    await openWorkspace(page, reminderState());

    await page.getByRole("alert").filter({ hasText: "交周报" }).getByRole("button", { name: "查看任务" }).click();

    await expect(page.locator(".workspace-todo-list")).toBeVisible();
    await expect(page.getByLabel("任务标题")).toHaveValue("交周报");
  });
});

test.describe("Todo 待办（移动壳）", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("MobileListTabs 出现待办入口，弹窗可新建任务", async ({ page }) => {
    await openWorkspace(page, baseState());

    const tab = page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByText("还没有待办任务")).toBeVisible();

    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("随身任务");
    await page.getByRole("button", { name: "添加任务" }).click();
    await expect(page.getByRole("button", { name: /随身任务/ })).toBeVisible();
  });

  test("点任务行进入全屏编辑面：列表不再就地展开，卡片同序、底部有状态与完成", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("随身任务");
    await page.getByRole("button", { name: "添加任务" }).click();

    const list = page.locator(".mobile-list-content");
    await list.getByRole("button", { name: /随身任务/ }).click();

    // 列表里不再就地展开编辑器，编辑走独立工作面（与「新建任务」同构）
    await expect(page.locator('[data-task-form="inline"]')).toHaveCount(0);
    await assertCardOrder(page, "pane");

    const dialog = page.getByRole("dialog", { name: "编辑任务" });
    const box = await dialog.boundingBox();
    const screen = page.viewportSize();
    expect(box?.width).toBe(screen?.width);
    await expect(page.getByRole("button", { name: "删除任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "完成" })).toBeVisible();
  });

  test("改标题自动落盘并给出「已保存」，点完成回到列表且改动还在", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("随身任务");
    await page.getByRole("button", { name: "添加任务" }).click();

    await page.getByRole("button", { name: /随身任务/ }).click();
    await page.getByLabel("任务标题").fill("随身任务（已改）");
    // 不需要按保存：防抖到期后状态区自己给出结果
    await expect(page.getByRole("status")).toContainText("已保存");

    await page.getByRole("button", { name: "完成" }).click();
    await expect(page.locator(".mobile-list-tabs")).toBeVisible();
    await expect(page.getByRole("button", { name: /随身任务（已改）/ })).toBeVisible();

    const update = (await calls(page)).find((entry) => entry.cmd === "task_update");
    expect(String(update?.args.title)).toBe("随身任务（已改）");
  });

  test("到点提醒卡片在移动壳同样可见，点「查看任务」展开该任务", async ({ page }) => {
    await openWorkspace(page, reminderState());

    const card = page.getByRole("alert").filter({ hasText: "交周报" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "查看任务" }).click();

    await expect(page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("任务标题")).toHaveValue("交周报");
  });
});

test.describe("Todo 待办（移动小屏 375×667）", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("日期/时间/提醒面板都在视口内，触控目标够大", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("随身任务");

    // 元数据条在卡片底部：矮视口下不滚动也能看到「明天 18:00」这类识别回显
    const chipBox = await page.getByRole("button", { name: "设置截止日期" }).boundingBox();
    const screen = page.viewportSize();
    expect(chipBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((chipBox?.y ?? 0) + (chipBox?.height ?? 0)).toBeLessThanOrEqual(screen?.height ?? 0);

    const inViewport = async (label: string) => {
      const box = await page.getByRole("menu", { name: label }).boundingBox();
      const size = page.viewportSize();
      if (!box || !size) throw new Error(`${label} 未渲染`);
      expect(box.y, `${label} 顶部越界`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `${label} 底部越界`).toBeLessThanOrEqual(size.height);
      expect(box.x, `${label} 左侧越界`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${label} 右侧越界`).toBeLessThanOrEqual(size.width);
    };

    // 日期面板：日历格子在触屏上要够大（≥40px）
    await page.getByRole("button", { name: "设置截止日期" }).click();
    await inViewport("设置截止日期");
    const cell = await page.getByRole("button", { name: /^\d{4}-\d{2}-\d{2}$/ }).first().boundingBox();
    expect(cell?.width ?? 0).toBeGreaterThanOrEqual(40);
    expect(cell?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.getByRole("button", { name: "明天" }).click();
    await page.getByRole("button", { name: "确认" }).click();

    // 时间面板：滚轮项 ≥36px
    await page.getByRole("button", { name: "设置时间" }).click();
    await inViewport("设置时间");
    const option = await page.getByLabel("小时").getByRole("option", { name: "18", exact: true }).boundingBox();
    expect(option?.height ?? 0).toBeGreaterThanOrEqual(36);
    await page.getByLabel("小时").getByRole("option", { name: "18", exact: true }).click();
    await page.getByRole("button", { name: "确认" }).click();

    // 提醒面板在矮视口下会被限高：面板不越界，底部确定按钮仍可点到
    await page.getByRole("button", { name: "设置提醒" }).click();
    await inViewport("设置提醒");
    await page.getByRole("button", { name: "15 分钟前" }).click();
    await expect(page.getByRole("menu", { name: "设置提醒" }).getByRole("button", { name: "确认" })).toBeVisible();
    await page.getByRole("menu", { name: "设置提醒" }).getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("menu", { name: "设置提醒" })).toBeHidden();
  });

  test("编辑面在小屏上仍完整：底部保存状态与「完成」落在视口内", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" }).click();
    await page.getByRole("button", { name: "新建任务" }).click();
    await page.getByLabel("任务标题").fill("随身任务");
    await page.getByRole("button", { name: "添加任务" }).click();

    await page.getByRole("button", { name: /随身任务/ }).click();
    await page.getByLabel("任务标题").fill("随身任务（已改）");

    // 状态区与操作条固定在底部：矮视口下不滚动也必须能看见并点到
    const status = await page.getByRole("status").boundingBox();
    const done = await page.getByRole("button", { name: "完成" }).boundingBox();
    const screen = page.viewportSize();
    const height = screen?.height ?? 0;
    for (const box of [status, done]) {
      if (!box) throw new Error("底部操作条未渲染");
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }

    // 卡片本体的元数据 chips 排在内容下方，仍在编辑面内可滚动到
    const chip = await page.getByRole("button", { name: "设置截止日期" }).boundingBox();
    expect(chip?.y ?? -1).toBeGreaterThanOrEqual(0);
  });
});
