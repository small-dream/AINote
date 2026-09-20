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

// 平台判定：不支持时的原因只在移动端展示，桌面 Windows / Linux 不出现噪音。
const runtimeMock = vi.hoisted(() => ({ isMobile: false }));
vi.mock("@/platform/runtime", () => ({ isMobileApp: () => runtimeMock.isMobile }));

const appError = (code: string, message: string) => ({ code, kind: "Unknown", message, retriable: false });

function renderCard(locked = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultQuickUnlockCard locked={locked} />
    </QueryClientProvider>
  );
}

function statusWith(quickUnlock: Record<string, unknown>) {
  return { state: "unlocked", encryptedNotes: 1, quickUnlock };
}

describe("VaultQuickUnlockCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeMock.isMobile = false;
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
  });

  it("桌面不支持时整块不渲染（Windows / Linux 不产生噪音）", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "unlocked", encryptedNotes: 1 });
    renderCard();

    await waitFor(() => expect(vaultApiMock.status).toHaveBeenCalled());
    expect(screen.queryByText("设备级快速解锁")).toBeNull();
  });

  it("移动端不支持时写明原因，用户不会再看到「选项凭空消失」", async () => {
    runtimeMock.isMobile = true;
    vaultApiMock.status.mockResolvedValue(
      statusWith({ supported: false, enabled: false, kind: null, reason: "noDeviceLock" })
    );
    renderCard();

    expect(await screen.findByText(/设备还没有设置锁屏密码/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "本机暂不支持设备级快速解锁：设备还没有设置锁屏密码 / 图案 / PIN"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("探测失败的原因码也有可读文案（便于用户回传）", async () => {
    runtimeMock.isMobile = true;
    vaultApiMock.status.mockResolvedValue(
      statusWith({ supported: false, enabled: false, kind: null, reason: "probeFailed" })
    );
    renderCard();

    expect((await screen.findByRole("status")).textContent).toContain("系统能力探测失败");
  });
});

describe("VaultQuickUnlockCard · 开关", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeMock.isMobile = false;
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
  });

  it("已支持但仓库锁定时区块仍在，只是禁用并提示先解锁", async () => {
    vaultApiMock.status.mockResolvedValue(
      statusWith({ supported: true, enabled: false, kind: "biometric", reason: null })
    );
    renderCard(true);

    expect(await screen.findByText(/先用仓库口令解锁/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "开启快速解锁" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("已支持且未开启时提供开启入口，并提示条目只留在本机", async () => {
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
});

describe("VaultQuickUnlockCard · 认证失败兜底", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeMock.isMobile = false;
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
  });

  it("用户取消系统认证不算失败：不显示红色错误，开关保持原状", async () => {
    vaultApiMock.status.mockResolvedValue(
      statusWith({ supported: true, enabled: false, kind: "touchId" })
    );
    vaultApiMock.enableQuickUnlock.mockRejectedValue(
      appError("VAULT_9007", "vault device auth cancelled: 已取消")
    );
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "开启快速解锁" }));

    await waitFor(() => expect(vaultApiMock.enableQuickUnlock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "开启快速解锁" })).toBeTruthy();
  });

  it("开启失败（非取消）时给出本地化文案", async () => {
    vaultApiMock.status.mockResolvedValue(
      statusWith({ supported: true, enabled: false, kind: "touchId" })
    );
    vaultApiMock.enableQuickUnlock.mockRejectedValue(
      appError("VAULT_9008", "vault device auth failed: 生物识别已被系统锁定")
    );
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "开启快速解锁" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "设备认证失败，请重试，或直接在下方输入仓库口令解锁。"
    );
  });
});
