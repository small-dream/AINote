import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog, type PendingDelete } from "./DeleteConfirmDialog";

const NOTE: PendingDelete = { path: "daily/a.md", name: "a.md", isFolder: false };
const FOLDER: PendingDelete = { path: "daily", name: "daily", isFolder: true };

function renderDialog(pending: PendingDelete | null, overrides: { busy?: boolean } = {}) {
  const onOpenTrash = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DeleteConfirmDialog
      pending={pending}
      busy={overrides.busy ?? false}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      onOpenTrash={onOpenTrash}
    />,
  );
  return { onOpenTrash, onConfirm };
}

describe("DeleteConfirmDialog", () => {
  it("确认删除前说明会进入回收站并提供恢复入口", () => {
    const { onOpenTrash } = renderDialog(NOTE);
    expect(screen.getByText("删除后可在回收站中恢复。")).toBeTruthy();
    expect(screen.getByText("恢复入口：侧边栏「回收站」")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开回收站" }));
    expect(onOpenTrash).toHaveBeenCalledTimes(1);
  });

  it("删除目录同样给出回收站恢复入口", () => {
    renderDialog(FOLDER);
    expect(screen.getByText("目录中的笔记会移入回收站。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开回收站" })).toBeTruthy();
  });

  it("删除进行中时禁用恢复入口", () => {
    renderDialog(NOTE, { busy: true });
    expect(screen.getByRole("button", { name: "打开回收站" }).hasAttribute("disabled")).toBe(true);
  });

  it("没有待删除目标时不渲染", () => {
    const { container } = render(
      <DeleteConfirmDialog pending={null} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} onOpenTrash={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
