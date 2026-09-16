import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownContextMenu } from "./MarkdownContextMenu";

type Menu = Parameters<typeof MarkdownContextMenu>[0]["menu"];

function createMenu(): Menu {
  return {
    position: { x: 10, y: 10, hasSelection: true },
    handleContextMenu: vi.fn(),
    openAt: vi.fn(),
    close: vi.fn(),
    runInline: vi.fn(),
    runClipboard: vi.fn(),
    runSelectAll: vi.fn(),
    runLink: vi.fn(),
    runPaste: vi.fn(),
    openAi: vi.fn(),
  };
}

function renderMenu(aiBlocked = false) {
  const menu = createMenu();
  render(<MarkdownContextMenu menu={menu} noteTheme="classic" aiBlocked={aiBlocked} />);
  return menu;
}

describe("MarkdownContextMenu", () => {
  it("默认渲染 AI 写作入口并触发 openAi", () => {
    const menu = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "AI 写作" }));
    expect(menu.openAi).toHaveBeenCalledTimes(1);
  });

  it("加密笔记：不渲染 AI 菜单项（决策③，不提供入口）", () => {
    renderMenu(true);
    expect(screen.queryByRole("menuitem", { name: "AI 写作" })).toBeNull();
    // 剪贴板与格式项不受影响
    expect(screen.getByRole("menuitem", { name: "复制" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "加粗" })).toBeTruthy();
  });
});
