import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { VaultQuickUnlockCard } from "./VaultQuickUnlockCard";

const vaultApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  enableQuickUnlock: vi.fn(),
  disableQuickUnlock: vi.fn(),
}));
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

const appError = (code: string, message: string) => ({ code, kind: "Unknown", message, retriable: false });

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultQuickUnlockCard />
    </QueryClientProvider>
  );
}

function statusWith(quickUnlock: { supported: boolean; enabled: boolean; kind: string | null }) {
  return { state: "unlocked", encryptedNotes: 1, quickUnlock };
}

describe("VaultQuickUnlockCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
  });

  it("平台不支持时整块不渲染（Windows / Linux / Android 9 以下）", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "unlocked", encryptedNotes: 1 });
    renderCard();

    await waitFor(() => expect(vaultApiMock.status).toHaveBeenCalled());
    expect(screen.queryByText("设备级快速解锁")).toBeNull();
  });

  it("已支持但未开启时提供开启入口，并提示条目只留在本机", async () => {
    // 开启成功后前端会失效并重取状态：mock 也要跟着切换，否则断言的是过期状态。
    vaultApiMock.status
      .mockResolvedValueOnce(statusWith({ supported: true, enabled: false, kind: "touchId" }))
      .mockResolvedValue(statusWith({ supported: true, enabled: true, kind: "touchId" }));
    vaultApiMock.enableQuickUnlock.mockResolvedValue(
      statusWith({ supported: true, enabled: true, kind: "touchId" })
    );
    renderCard();

    const enable = (await screen.findByRole("button", { name: "开启快速解锁" })) as HTMLButtonElement;
    expect(screen.getByText(/不进仓库/)).toBeTruthy();
    fireEvent.click(enable);

    await waitFor(() => expect(vaultApiMock.enableQuickUnlock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("本机已开启：Touch ID")).toBeTruthy();
  });

  it("已开启时展示认证方式并提供关闭入口", async () => {
    vaultApiMock.status
      .mockResolvedValueOnce(statusWith({ supported: true, enabled: true, kind: "faceId" }))
      .mockResolvedValue(statusWith({ supported: true, enabled: false, kind: "faceId" }));
    vaultApiMock.disableQuickUnlock.mockResolvedValue(
      statusWith({ supported: true, enabled: false, kind: "faceId" })
    );
    renderCard();

    expect(await screen.findByText("本机已开启：Face ID")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭快速解锁" }));

    await waitFor(() => expect(vaultApiMock.disableQuickUnlock).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "开启快速解锁" })).toBeTruthy();
  });

  it("用户取消系统认证不算失败：不显示红色错误，开关保持原状", async () => {
    vaultApiMock.status.mockResolvedValue(statusWith({ supported: true, enabled: false, kind: "touchId" }));
    vaultApiMock.enableQuickUnlock.mockRejectedValue(appError("VAULT_9007", "vault device auth cancelled: 已取消"));
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "开启快速解锁" }));

    await waitFor(() => expect(vaultApiMock.enableQuickUnlock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "开启快速解锁" })).toBeTruthy();
  });

  it("开启失败（非取消）时给出本地化文案", async () => {
    vaultApiMock.status.mockResolvedValue(statusWith({ supported: true, enabled: false, kind: "touchId" }));
    vaultApiMock.enableQuickUnlock.mockRejectedValue(
      appError("VAULT_9008", "vault device auth failed: 生物识别已被系统锁定")
    );
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "开启快速解锁" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("设备认证失败，请重试或改用仓库口令。");
  });
});
