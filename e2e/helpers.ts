import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";

/** 注入种子并在测试前端（?e2e 启用 IPC mock）中打开工作区。 */
export async function openWorkspace(page: Page, state: E2eState): Promise<void> {
  await page.addInitScript((seed) => {
    (globalThis as unknown as { __E2E_STATE__?: unknown }).__E2E_STATE__ = seed;
    (globalThis as unknown as { __E2E_RECORD__?: unknown[] }).__E2E_RECORD__ = [];
  }, state);
  await page.goto("/?e2e");
  await expect(page.getByText("全部笔记").first()).toBeVisible({ timeout: 15_000 });
}

/** 记录 mock 收到的 IPC 调用（用于自动保存断言）。 */
export async function calls(page: Page): Promise<Array<{ cmd: string; args: Record<string, unknown> }>> {
  return page.evaluate(() => {
    const global = globalThis as unknown as { __E2E_RECORD__?: Array<{ cmd: string; args: Record<string, unknown> }> };
    return global.__E2E_RECORD__ ?? [];
  });
}

/** 在目录树中打开指定文件名（不含扩展名）的笔记并等待编辑器就绪。 */
export async function openNote(page: Page, fileName: string, marker: string): Promise<void> {
  await page.getByRole("button", { name: fileName, exact: true }).first().click();
  await expect(page.locator(".cm-content").first()).toContainText(marker, { timeout: 15_000 });
}
