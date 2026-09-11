import { expect, test } from "@playwright/test";
import type { E2eState } from "../src/e2e/types";
import { openNote, openWorkspace } from "./helpers";

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
