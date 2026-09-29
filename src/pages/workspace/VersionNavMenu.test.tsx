import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionNavMenu } from "./VersionNavMenu";

vi.mock("@/features/commit/components/CommitDialog", () => ({
  CommitDialog: () => <div role="dialog" aria-label="提交版本" />,
}));
vi.mock("@/features/discard/components/DiscardDialog", () => ({
  DiscardDialog: () => <div role="dialog" aria-label="丢弃本地改动" />,
}));
vi.mock("@/features/git-graph/components/GitGraphPanel", () => ({
  GitGraphPanel: () => <div role="dialog" aria-label="Git 历史" />,
}));

function renderMenu(hasUncommitted = false) {
  return render(<VersionNavMenu repoPath="/repo" hasUncommitted={hasUncommitted} buttonClass="nav-button" />);
}

describe("VersionNavMenu", () => {
  it("三个 Git 入口合并为单个「版本」按钮，菜单内呈现提交 / 丢弃 / 图谱", () => {
    renderMenu();
    expect(screen.queryByRole("button", { name: "提交版本" })).toBeNull();
    expect(screen.queryByRole("button", { name: "丢弃本地改动" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Git 历史" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    expect(screen.getByRole("menuitem", { name: "提交版本" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "丢弃本地改动" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Git 历史" })).toBeTruthy();
  });

  it("「丢弃」菜单项以危险操作样式呈现", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    expect(screen.getByRole("menuitem", { name: "丢弃本地改动" }).className).toContain("text-danger");
  });

  it("未提交变更徽标迁移到「版本」入口上", () => {
    const { unmount } = renderMenu(true);
    expect(screen.getByRole("button", { name: "版本" }).querySelector("span")).toBeTruthy();
    unmount();
    renderMenu(false);
    expect(screen.getByRole("button", { name: "版本" }).querySelector("span")).toBeNull();
  });

  it("菜单项进入原有对应流程：提交打开 CommitDialog", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "提交版本" }));
    expect(await screen.findByRole("dialog", { name: "提交版本" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("丢弃 / 图谱菜单项分别打开 DiscardDialog 与 GitGraphPanel", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "丢弃本地改动" }));
    expect(await screen.findByRole("dialog", { name: "丢弃本地改动" })).toBeTruthy();

    renderMenu();
    fireEvent.click(screen.getAllByRole("button", { name: "版本" })[1] as HTMLElement);
    fireEvent.click(screen.getByRole("menuitem", { name: "Git 历史" }));
    expect(await screen.findByRole("dialog", { name: "Git 历史" })).toBeTruthy();
  });
});
