import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "first.md", content: "# 第一篇" }] };
}

/** 预置一个清单：桌面工作区据此渲染 Quick Add 与任务列表。 */
function boardState(): E2eState {
  return {
    ...baseState(),
    taskBoard: {
      schemaVersion: 2,
      lists: [{ id: "l1", name: "工作", sortOrder: 0, createdAt: "2026-09-01T00:00:00Z" }],
      tasks: [],
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

test.describe("Todo 清单（桌面壳）", () => {
  test("建清单 → 建任务 → 设置截止日期 → 勾选完成", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await expect(page.getByText("还没有待办清单")).toBeVisible();

    await page.getByPlaceholder("清单名称").fill("工作");
    await page.getByRole("button", { name: "创建清单" }).click();
    await expect(page.getByRole("button", { name: "工作" })).toBeVisible();

    const quickAdd = page.getByPlaceholder(/添加任务/);
    await quickAdd.fill("写周报");
    await quickAdd.press("Enter");
    const taskRow = page.getByRole("button", { name: /写周报/ });
    await expect(taskRow).toBeVisible();

    await taskRow.click();
    await page.locator("section").getByRole("button", { name: "设置截止日期" }).click();
    await page.getByLabel("选择日期").fill("2026-09-20");
    await page.keyboard.press("Escape");
    await expect(taskRow).toContainText("09-20");

    await page.getByRole("checkbox", { name: "写周报" }).click();
    // 勾选后任务移入默认折叠的「已完成」分组：任务行消失、分组计数变 1
    await expect(page.getByRole("button", { name: /已完成/ })).toContainText("1");

    const recorded = await calls(page);
    const commands = recorded.map((entry) => entry.cmd);
    expect(commands).toContain("task_create_list");
    expect(commands).toContain("task_create");
    expect(commands).toContain("task_update");
    expect(commands).toContain("task_toggle");
    const update = recorded.find((entry) => entry.cmd === "task_update");
    expect(update?.args.dueDate).toBe("2026-09-20");
  });

  test("阅读主题「内容与工作区」：待办工作区与目录侧栏同色，且清单条保留层次", async ({ page }) => {
    await presetNoteTheme(page, "forest", "workspace");
    await openWorkspace(page, boardState());

    const treeBg = await background(page, ".workspace-sidebar");
    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.locator(".workspace-todo-list").waitFor();

    const listBg = await background(page, ".workspace-todo-list");
    expect(listBg).toBe(treeBg);
    // 未联动时侧栏底色为应用亮色 --bg-secondary
    expect(listBg).not.toBe("rgb(245, 247, 250)");
    // Quick Add 条比清单列更深一档，卡片才浮得起来
    expect(await background(page, ".workspace-todo-form")).not.toBe(listBg);
  });

  test("阅读主题「仅内容」：待办工作区保持应用主题配色", async ({ page }) => {
    await presetNoteTheme(page, "forest", "content");
    await openWorkspace(page, boardState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await page.locator(".workspace-todo-list").waitFor();

    expect(await background(page, ".workspace-todo-list")).toBe("rgb(245, 247, 250)");
  });
});

test.describe("Todo 清单（移动壳）", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("MobileListTabs 出现待办入口并可打开面板", async ({ page }) => {
    await openWorkspace(page, baseState());

    const tab = page.locator(".mobile-list-tabs").getByRole("tab", { name: "待办" });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByText("还没有待办清单")).toBeVisible();

    await page.getByPlaceholder("清单名称").fill("随身");
    await page.getByRole("button", { name: "创建清单" }).click();
    await expect(page.getByRole("button", { name: "随身" })).toBeVisible();
  });
});
