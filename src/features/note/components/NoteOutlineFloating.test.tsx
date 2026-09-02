import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteOutlineFloating } from "./NoteOutlineFloating";

const ITEMS = [{ id: "intro", text: "介绍", level: 1, line: 1 }];

afterEach(() => {
  vi.useRealTimers();
});

describe("NoteOutlineFloating", () => {
  it("悬停时展示大纲并支持点击标题定位", () => {
    const onSelect = vi.fn();
    const { container } = render(<NoteOutlineFloating items={ITEMS} open={false} onToggle={vi.fn()} onSelect={onSelect} />);
    const floating = container.firstElementChild as HTMLElement;

    const panel = container.querySelector(".note-outline-floating-panel");
    expect(panel?.classList.contains("is-visible")).toBe(false);
    fireEvent.mouseEnter(floating);
    expect(panel?.classList.contains("is-visible")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "介绍" }));

    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

  it("点击悬浮入口切换固定状态", () => {
    const onToggle = vi.fn();
    render(<NoteOutlineFloating items={ITEMS} open={false} onToggle={onToggle} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "大纲" }));

    expect(onToggle).toHaveBeenCalledOnce();
  });

});

describe("NoteOutlineFloating dismissal", () => {

  it("固定展开后再次点击可以立即收起", () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(<NoteOutlineFloating items={ITEMS} open onToggle={onToggle} onSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "大纲" });
    const panel = container.querySelector(".note-outline-floating-panel");

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(panel?.classList.contains("is-visible")).toBe(true);
    fireEvent.click(trigger);
    rerender(<NoteOutlineFloating items={ITEMS} open={false} onToggle={onToggle} onSelect={vi.fn()} />);

    expect(panel?.classList.contains("is-visible")).toBe(false);
  });

  it("点击编辑区外部可以收起固定浮窗", () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(<NoteOutlineFloating items={ITEMS} open onToggle={onToggle} onSelect={vi.fn()} />);
    const panel = container.querySelector(".note-outline-floating-panel");

    fireEvent.pointerDown(document.body);
    rerender(<NoteOutlineFloating items={ITEMS} open={false} onToggle={onToggle} onSelect={vi.fn()} />);

    expect(onToggle).toHaveBeenCalledOnce();
    expect(panel?.classList.contains("is-visible")).toBe(false);
  });

  it("入口离开后仍可在过渡期间点击面板标题", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const { container } = render(<NoteOutlineFloating items={ITEMS} open={false} onToggle={vi.fn()} onSelect={onSelect} />);
    const floating = container.firstElementChild as HTMLElement;

    fireEvent.mouseEnter(floating);
    fireEvent.mouseLeave(floating);
    fireEvent.click(screen.getByRole("button", { name: "介绍" }));

    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });
});
