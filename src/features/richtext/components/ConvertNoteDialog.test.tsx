import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConvertNoteDialog } from "./ConvertNoteDialog";

describe("ConvertNoteDialog", () => {
  it("按检测项逐项列出将丢失的内容", () => {
    render(<ConvertNoteDialog open losses={["frontmatter", "wikiLink"]} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("Frontmatter 元数据（--- 属性块）")).toBeTruthy();
    expect(screen.getByText("双链（[[...]]）高亮与点击跳转")).toBeTruthy();
    expect(screen.queryByText("脚注（[^1] 引用与定义）")).toBeNull();
  });

  it("无损失时不渲染损失列表，仍展示回滚说明", () => {
    render(<ConvertNoteDialog open losses={[]} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/回收站/)).toBeTruthy();
  });

  it("Enter 确认、Esc 取消", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConvertNoteDialog open losses={[]} onConfirm={onConfirm} onCancel={onCancel} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog.querySelector("div") as HTMLElement, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("转换中禁用按钮并展示进行中文案", () => {
    render(<ConvertNoteDialog open losses={[]} converting onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("button", { name: "转换中…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "取消" }).hasAttribute("disabled")).toBe(true);
  });
});
