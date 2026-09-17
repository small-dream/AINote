import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { calls, openNote, openWorkspace } from "./helpers";

function baseState(): E2eState {
  return { repoPath: "/mock-repo", notes: [{ path: "first.md", content: "# 第一篇" }] };
}

/** 读取移动壳内可编辑控件的实际字号（px）。 */
function editableFontSizes(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const sizeOf = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? parseFloat(getComputedStyle(node).fontSize) : null;
    };
    return {
      search: sizeOf(".tree-search-input"),
      title: sizeOf(".note-title-input"),
      editor: sizeOf(".cm-content"),
    };
  });
}

test.describe("移动端可编辑控件字号（防 iOS 聚焦缩放）", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("目录搜索、笔记标题与正文都不低于 16px", async ({ page }) => {
    await openWorkspace(page, baseState());
    const search = await editableFontSizes(page);
    expect(search.search).toBeGreaterThanOrEqual(16);

    await openNote(page, "first", "第一篇");
    const note = await editableFontSizes(page);
    // iOS WebKit 在聚焦 <16px 的可编辑控件时会放大整个 WebView，导致移动壳左右被裁切
    expect(note.title).toBeGreaterThanOrEqual(16);
    expect(note.editor).toBeGreaterThanOrEqual(16);
  });
});

test.describe("桌面端可编辑控件字号不受影响", () => {
  test("桌面视口不套用移动端 16px 下限", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openNote(page, "first", "第一篇");
    const sizes = await editableFontSizes(page);
    expect(sizes.title).toBeLessThan(16);
    expect(sizes.editor).toBeLessThan(16);
  });
});

test.describe("移动端键盘与底部安全区", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  test("键盘遮挡高度让移动壳收缩到键盘上方", async ({ page }) => {
    await openWorkspace(page, baseState());
    const measured = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".mobile-workspace-shell");
      if (!shell) throw new Error("缺少移动壳");
      const height = () => shell.getBoundingClientRect().height;
      const before = height();
      // 真实设备上 --kb-inset 由 platform/keyboard-inset 按 visualViewport 写入
      shell.style.setProperty("--kb-inset", "300px");
      const during = height();
      shell.style.removeProperty("--kb-inset");
      return { before, during, after: height() };
    });

    expect(measured.before).toBeCloseTo(874, 0);
    expect(measured.during).toBeCloseTo(574, 0);
    expect(measured.after).toBeCloseTo(874, 0);
  });

  test("正文内容避开系统导航栏安全区", async ({ page }) => {
    await openWorkspace(page, baseState());
    await openNote(page, "first", "第一篇");
    const paddingBottom = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".mobile-workspace-shell");
      shell?.style.setProperty("--safe-bottom", "24px");
      const content = document.querySelector<HTMLElement>(".mobile-editor-pane .cm-content");
      return content ? getComputedStyle(content).paddingBottom : null;
    });

    // 24px 安全区（模拟系统导航栏）+ 1.5rem 呼吸位
    expect(paddingBottom).toBe("48px");
  });
});

test.describe("移动端冲突解决", () => {
  test.use({ viewport: { width: 402, height: 874 } });

  function conflictedState(): E2eState {
    return {
      repoPath: "/mock-repo",
      notes: [{ path: "daily/a.md", content: "# 本地版本\n" }],
      conflicted: true,
      conflicts: [{ path: "daily/a.md", local: "# 本地版本\n", remote: "# 远端版本\n" }],
    };
  }

  test("三栏折成单栏分页签，点「保留远端」即写回该侧内容并回到已同步", async ({ page }) => {
    await openWorkspace(page, conflictedState());
    await page.getByRole("button", { name: "存在冲突" }).click();

    const dialog = page.getByRole("dialog", { name: "daily/a.md" });
    await expect(dialog).toBeVisible();
    // 手机宽度下不再并排三栏，而是一次一栏的分页签
    await expect(dialog.locator(".conflict-panel-body")).toHaveCount(0);
    await expect(dialog.getByRole("tab", { name: "合并结果" })).toHaveAttribute("aria-selected", "true");

    await dialog.getByRole("tab", { name: "远端" }).click();
    await expect(dialog.getByText("# 远端版本")).toBeVisible();
    await dialog.getByRole("button", { name: "保留远端", exact: true }).click();

    await expect(page.getByRole("button", { name: "存在冲突" })).toBeHidden({ timeout: 10_000 });
    const resolutions = (await calls(page)).filter((call) => call.cmd === "resolve_file_conflict");
    expect(resolutions.at(-1)?.args).toMatchObject({ path: "daily/a.md", content: "# 远端版本\n" });
  });

  test("底部操作条贴在安全区之上，按钮保持 44px 触控高度", async ({ page }) => {
    await openWorkspace(page, conflictedState());
    await page.getByRole("button", { name: "存在冲突" }).click();

    const dialog = page.getByRole("dialog", { name: "daily/a.md" });
    const actions = dialog.locator(".conflict-mobile-actions");
    await expect(actions).toBeVisible();

    const buttons = actions.getByRole("button");
    await expect(buttons).toHaveCount(3);
    for (const label of ["保留本地", "保留远端", "保存合并"]) {
      const box = await actions.getByRole("button", { name: label, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
