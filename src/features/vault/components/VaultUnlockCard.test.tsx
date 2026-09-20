import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useVaultUnlockStore } from "@/stores/vault-unlock.store";
import { VaultUnlockCard } from "./VaultUnlockCard";

const vaultApiMock = vi.hoisted(() => ({ status: vi.fn(), unlock: vi.fn(), unlockWithDevice: vi.fn() }));
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

const appError = (code: string, message: string) => ({ code, kind: "Unknown", message, retriable: false });

function renderCard(onUnlocked: () => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultUnlockCard onUnlocked={onUnlocked} />
    </QueryClientProvider>
  );
}

function lockedStatus(enabled: boolean) {
  return {
    state: "locked",
    encryptedNotes: 2,
    quickUnlock: { supported: enabled, enabled, kind: enabled ? "touchId" : null },
  };
}

describe("VaultUnlockCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
    useVaultUnlockStore.setState({ suppressed: false, spent: false });
  });

  it("未开启快速解锁时只提供口令入口，也不自动触发设备认证", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(false));
    renderCard();

    await waitFor(() => expect(vaultApiMock.status).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Touch ID/ })).toBeNull();
    expect(screen.getByRole("button", { name: "解锁" })).toBeTruthy();
    expect(vaultApiMock.unlockWithDevice).not.toHaveBeenCalled();
  });

  it("已开启时锁定界面一出现就自动弹设备认证，用户不必先点按钮", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockResolvedValue({ state: "unlocked", encryptedNotes: 2 });
    const onUnlocked = vi.fn();
    renderCard(onUnlocked);

    // 关键断言：没有任何点击，设备认证已经发起，并在成功后回调 onUnlocked
    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });

  it("刚点过「立即锁定」时抑制自动触发，点按钮仍可手动解锁", async () => {
    useVaultUnlockStore.getState().suppress();
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockResolvedValue({ state: "unlocked", encryptedNotes: 2 });
    renderCard();

    const button = await screen.findByRole("button", { name: "用 Touch ID 解锁" });
    expect(vaultApiMock.unlockWithDevice).not.toHaveBeenCalled();

    fireEvent.click(button);
    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
  });

});

/** 设备认证不可用时的兜底：口令入口必须在位、够顺手，且错误文案要指向它。 */
describe("VaultUnlockCard · 认证失败兜底", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
    useVaultUnlockStore.setState({ suppressed: false, spent: false });
  });

  it("用户取消设备认证保持静默，且本次锁定周期内不再自动重复弹窗", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockRejectedValue(
      appError("VAULT_9007", "vault device auth cancelled: 已取消")
    );
    renderCard();

    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(useVaultUnlockStore.getState().spent).toBe(true);
    // 口令入口与按钮都还在：用户可以手动重试
    expect(screen.getByLabelText("仓库口令")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "用 Touch ID 解锁" }));
    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(2));
  });

  it("条目失效时提示用口令解锁，后端文案经本地化", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockRejectedValue(
      appError("VAULT_9006", "vault quick unlock unavailable: 指纹变更")
    );
    renderCard();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("本机的快速解锁条目已失效，请在下方输入仓库口令解锁，然后重新开启。");
  });

  it("设备认证失败后口令入口仍在，且自动聚焦可直接输入", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockRejectedValue(
      appError("VAULT_9008", "vault device auth failed: 指纹已被系统锁定")
    );
    vaultApiMock.unlock.mockResolvedValue({ state: "unlocked", encryptedNotes: 2 });
    const onUnlocked = vi.fn();
    renderCard(onUnlocked);

    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toBeTruthy();

    // 关键：失败后焦点已经在仓库口令输入框里，用户可以直接敲口令
    const input = screen.getByLabelText("仓库口令") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: "解锁" }));

    await waitFor(() => expect(vaultApiMock.unlock).toHaveBeenCalledWith("correct horse battery"));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });
});
