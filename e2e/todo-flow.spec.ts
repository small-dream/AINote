import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "first.md", content: "# 第一篇" }] };
}

test.describe("Todo 清单（桌面壳）", () => {
  test("建清单 → 建任务 → 设置截止日期 → 勾选完成", async ({ page }) => {
    await openWorkspace(page, baseState());

    await page.getByRole("button", { name: "待办", exact: true }).click();
    await expect(page.getByText("还没有待办清单")).toBeVisible();

    await page.getByPlaceholder("清单名称").fill("工作");
    await page.getByRole("button", { name: "创建清单" }).click();
    await expect(page.getByRole("button", { name: "工作" })).toBeVisible();

    const quickAdd = page.getByPlaceholder("添加任务，Enter 创建");
    await quickAdd.fill("写周报");
    await quickAdd.press("Enter");
    await expect(page.getByText("写周报")).toBeVisible();

    await page.getByText("写周报").click();
    await page.locator('input[type="date"]').fill("2026-09-20");
    await expect(page.getByText("09-20")).toBeVisible();

    await page.getByRole("checkbox", { name: "写周报" }).click();
    await expect(page.getByRole("button", { name: /已完成/ })).toBeVisible();

    const recorded = await calls(page);
    const commands = recorded.map((entry) => entry.cmd);
    expect(commands).toContain("task_create_list");
    expect(commands).toContain("task_create");
    expect(commands).toContain("task_update");
    expect(commands).toContain("task_toggle");
    const update = recorded.find((entry) => entry.cmd === "task_update");
    expect(update?.args.dueDate).toBe("2026-09-20");
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
