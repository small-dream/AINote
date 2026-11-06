import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeadingDropdown } from "./HeadingDropdown";

describe("HeadingDropdown", () => {
  it("无激活标题时显示正文", () => {
    render(<HeadingDropdown active={new Set()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "标题级别" }).textContent).toContain("正文");
  });

  it("光标位于 H4-H6 时回显对应级别，不再误显示正文", () => {
    for (const level of [4, 5, 6]) {
      const { unmount } = render(<HeadingDropdown active={new Set([`h${level}`])} onSelect={vi.fn()} />);
      expect(screen.getByRole("button", { name: "标题级别" }).textContent).toContain(`H${level}`);
      unmount();
    }
  });

  it("当前级别只作为值展示：关闭态不用选中底色，展开时才用 accent", () => {
    render(<HeadingDropdown active={new Set(["h2"])} onSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "标题级别" });
    expect(trigger.className).toContain("text-text-primary");
    expect(trigger.className).not.toContain("bg-accent-soft");

    fireEvent.click(trigger);
    expect(trigger.className).toContain("bg-accent-soft");
  });

  it("下拉提供正文与 H1-H6 共七个级别，选中后回调级别", () => {
    const onSelect = vi.fn();
    render(<HeadingDropdown active={new Set()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "标题级别" }));
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["正文", "H1", "H2", "H3", "H4", "H5", "H6"]);

    fireEvent.click(screen.getByRole("button", { name: "H6" }));
    expect(onSelect).toHaveBeenCalledWith(6);
  });
});
