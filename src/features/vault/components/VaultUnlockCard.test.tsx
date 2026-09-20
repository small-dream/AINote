import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
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
  });

  it("未开启快速解锁时只提供口令入口", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(false));
    renderCard();

    await waitFor(() => expect(vaultApiMock.status).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Touch ID/ })).toBeNull();
    expect(screen.getByRole("button", { name: "解锁" })).toBeTruthy();
  });

  it("已开启时提供设备解锁主操作，成功后回调 onUnlocked", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockResolvedValue({ state: "unlocked", encryptedNotes: 2 });
    const onUnlocked = vi.fn();
    renderCard(onUnlocked);

    fireEvent.click(await screen.findByRole("button", { name: "用 Touch ID 解锁" }));

    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "解锁" })).toBeTruthy();
  });

  it("取消设备认证保持静默，口令入口仍可用", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockRejectedValue(appError("VAULT_9007", "vault device auth cancelled: 已取消"));
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "用 Touch ID 解锁" }));

    await waitFor(() => expect(vaultApiMock.unlockWithDevice).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("仓库口令")).toBeTruthy();
  });

  it("条目失效时提示用口令解锁，后端文案经本地化", async () => {
    vaultApiMock.status.mockResolvedValue(lockedStatus(true));
    vaultApiMock.unlockWithDevice.mockRejectedValue(
      appError("VAULT_9006", "vault quick unlock unavailable: 指纹变更")
    );
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "用 Touch ID 解锁" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("本机的快速解锁条目已失效，请用仓库口令解锁后重新开启。");
  });
});
