import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { VaultUnlockDialog } from "./VaultUnlockDialog";

const vaultApiMock = vi.hoisted(() => ({ status: vi.fn(), unlock: vi.fn() }));
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultUnlockDialog />
    </QueryClientProvider>
  );
}

describe("VaultUnlockDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
    useUiStore.setState({ vaultDialogOpen: false });
    vaultApiMock.status.mockResolvedValue({ state: "locked", encryptedNotes: 1 });
  });

  it("默认不渲染，打开后展示就地解锁表单", () => {
    renderDialog();
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => useUiStore.getState().openVaultDialog());
    expect(screen.getByRole("dialog", { name: "解锁加密笔记" })).toBeTruthy();
  });

  it("解锁成功后自动关闭", async () => {
    vaultApiMock.unlock.mockResolvedValue({ state: "unlocked", encryptedNotes: 1 });
    renderDialog();
    act(() => useUiStore.getState().openVaultDialog());

    const input = (await screen.findByLabelText("仓库口令")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: "解锁" }));

    await waitFor(() => expect(useUiStore.getState().vaultDialogOpen).toBe(false));
  });

  it("关闭按钮可关闭弹层", () => {
    renderDialog();
    act(() => useUiStore.getState().openVaultDialog());

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    });
    expect(useUiStore.getState().vaultDialogOpen).toBe(false);
  });

  it("Esc 可关闭弹层", () => {
    renderDialog();
    act(() => useUiStore.getState().openVaultDialog());

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(useUiStore.getState().vaultDialogOpen).toBe(false);
  });
});
