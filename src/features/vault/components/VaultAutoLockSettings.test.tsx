import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { VaultAutoLockSettings } from "./VaultAutoLockSettings";

describe("VaultAutoLockSettings", () => {
  beforeEach(() => {
    useUiStore.setState({ vaultAutoLock: 5 });
    localStorage.clear();
  });

  it("渲染全部时长选项并高亮当前值", () => {
    render(<VaultAutoLockSettings />);

    const group = screen.getByRole("radiogroup", { name: "自动锁定" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "从不" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "5 分钟" }).getAttribute("aria-checked")).toBe("true");
  });

  it("选择选项后写入 store 与 localStorage", () => {
    render(<VaultAutoLockSettings />);

    fireEvent.click(screen.getByRole("radio", { name: "30 分钟" }));
    expect(useUiStore.getState().vaultAutoLock).toBe(30);
    expect(localStorage.getItem("ainote.vault-auto-lock")).toBe("30");
  });
});
