import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { EditorStatusBar } from "./EditorStatusBar";

afterEach(() => useUiStore.setState({ focusMode: false, typewriterMode: false }));

describe("EditorStatusBar", () => {
  it("展示字数与行列", () => {
    render(<EditorStatusBar characters={12} cursor={{ line: 3, column: 7 }} />);
    expect(screen.getByText("12 字")).toBeTruthy();
    expect(screen.getByText("第 3 行，第 7 列")).toBeTruthy();
  });

  it("切换打字机滚动与专注模式并持久化 UI 状态", () => {
    render(<EditorStatusBar characters={0} cursor={{ line: 1, column: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "开启打字机滚动" }));
    expect(useUiStore.getState().typewriterMode).toBe(true);
    expect(screen.getByRole("button", { name: "关闭打字机滚动" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "专注模式" }));
    expect(useUiStore.getState().focusMode).toBe(true);
    expect(screen.getByRole("button", { name: "退出专注模式" })).toBeTruthy();
  });
});
