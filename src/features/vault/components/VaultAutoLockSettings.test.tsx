import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { VaultAutoLockSettings } from "./VaultAutoLockSettings";

describe("VaultAutoLockSettings", () => {
  beforeEach(() => {
    useUiStore.setState({ vaultAutoLock: 30 });
    localStorage.clear();
  });

  it("渲染全部时长选项并高亮当前值", () => {
    render(<VaultAutoLockSettings />);

    const group = screen.getByRole("radiogroup", { name: "自动锁定" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "从不" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "30 分钟" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("radio", { name: "5 分钟" })).toBeNull();
  });

  it("选择选项后写入 store 与 localStorage", () => {
    render(<VaultAutoLockSettings />);

    fireEvent.click(screen.getByRole("radio", { name: "2 小时" }));
    expect(useUiStore.getState().vaultAutoLock).toBe(120);
    expect(localStorage.getItem("ainote.vault-auto-lock")).toBe("120");
  });

  it("默认值为「从不」时高亮从不选项", () => {
    useUiStore.setState({ vaultAutoLock: 0 });
    render(<VaultAutoLockSettings />);

    expect(screen.getByRole("radio", { name: "从不" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "30 分钟" }).getAttribute("aria-checked")).toBe("false");
  });
});
