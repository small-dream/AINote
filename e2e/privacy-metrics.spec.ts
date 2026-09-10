import { expect, test, type Page } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return {
    repoPath: "/mock-repo",
    appVersion: "0.24.12",
    notes: [{ path: "daily/a.md", content: "# 笔记\n\n正文" }],
  };
}

/** 打开「设置 → 诊断与反馈」并等待隐私与度量卡片出现。 */
async function openMetricsCard(page: Page): Promise<void> {
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "诊断与反馈" }).click();
  await expect(page.getByRole("heading", { name: "本机使用计数" })).toBeVisible();
}

async function dismissNoticeIfVisible(page: Page): Promise<void> {
  const ok = page.getByRole("button", { name: "知道了" });
  if (await ok.isVisible()) await ok.click();
}

test.describe("隐私与度量（E5-T2）", () => {
  test("首次打开设置展示本机计数说明，确认后不再出现", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openMetricsCard(page);

    const notice = page.getByRole("status").filter({ hasText: "关于本机使用计数" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("不包含笔记内容与路径");
    await notice.getByRole("button", { name: "知道了" }).click();
    await expect(notice).toBeHidden();

    // 整页重新加载（保留 ?e2e，路由跳转会丢掉查询串）验证说明只出现一次
    await page.goto("/?e2e");
    await expect(page.getByText("全部笔记").first()).toBeVisible();
    await openMetricsCard(page);
    await expect(page.getByRole("status").filter({ hasText: "关于本机使用计数" })).toHaveCount(0);
  });

  test("可关闭开关并清空本机计数", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openMetricsCard(page);
    await dismissNoticeIfVisible(page);

    const toggle = page.getByRole("switch", { name: "记录本机使用计数" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("已关闭本机计数，不再写入新记录")).toBeVisible();
    await expect
      .poll(async () => (await calls(page)).filter((call) => call.cmd === "metrics_set_enabled").length)
      .toBe(1);

    page.on("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "清空本机计数" }).click();
    await expect(page.getByText("已清空本机计数")).toBeVisible();
    await expect(page.getByText("本机已记录 0 次事件")).toBeVisible();
  });

  test("关闭状态经 IPC 持久化，重新打开设置仍然关闭", async ({ page }) => {
    const state = baseState();
    state.metricsEnabled = false;
    await openWorkspace(page, state);
    await openMetricsCard(page);

    await expect(page.getByRole("switch", { name: "记录本机使用计数" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

test.describe("隐私与度量（E5-T2）/ 移动单栏壳", () => {
  test.use({ viewport: { width: 430, height: 900 } });

  test("窄屏同样可查看说明并切换开关", async ({ page }) => {
    await openWorkspace(page, baseState());
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "诊断与反馈" }).click();

    await expect(page.getByRole("heading", { name: "本机使用计数" })).toBeVisible();
    await dismissNoticeIfVisible(page);
    const toggle = page.getByRole("switch", { name: "记录本机使用计数" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
