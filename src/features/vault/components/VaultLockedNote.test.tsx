import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { VaultLockedNote } from "./VaultLockedNote";

describe("VaultLockedNote", () => {
  beforeEach(() => {
    useUiStore.setState({ settingsOpen: false, settingsTab: "repositories" });
  });

  it("锁定态编辑区只显示解锁说明与路径，不渲染任何正文", () => {
    render(<VaultLockedNote notePath="sub/secret.md" />);

    expect(screen.getByText("这篇笔记已加密")).toBeTruthy();
    expect(screen.getByText(/sub\/secret\.md/)).toBeTruthy();
  });

  it("解锁入口直达设置页加密分类", () => {
    render(<VaultLockedNote notePath="sub/secret.md" />);

    fireEvent.click(screen.getByRole("button", { name: "前往解锁" }));
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsTab).toBe("vault");
  });
});
