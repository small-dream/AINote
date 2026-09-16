import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { VaultSettings } from "./VaultSettings";

const vaultApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  create: vi.fn(),
  unlock: vi.fn(),
  lock: vi.fn(),
  changePassphrase: vi.fn(),
}));
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultSettings />
    </QueryClientProvider>
  );
}

const passphraseInput = () => screen.getByLabelText("仓库口令") as HTMLInputElement;

describe("VaultSettings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
  });

  it("未建库时展示建库表单，口令不达标则禁用提交", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "absent", encryptedNotes: 0 });
    renderSettings();

    expect(await screen.findByText("启用加密笔记")).toBeTruthy();
    expect(screen.getByText("仓库中已有 0 篇加密笔记")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "启用加密" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(passphraseInput(), { target: { value: "short" } });
    expect(screen.getByText("口令至少需要 6 个字符")).toBeTruthy();
    expect(submit.disabled).toBe(true);
  });

  it("口令与仓库名相同时拒绝提交", async () => {
    useSessionStore.setState({ repoPath: "/repo/verylongreponame", currentNotePath: null, login: null });
    vaultApiMock.status.mockResolvedValue({ state: "absent", encryptedNotes: 0 });
    renderSettings();

    await screen.findByText("启用加密笔记");
    fireEvent.change(passphraseInput(), { target: { value: "verylongreponame" } });
    expect(screen.getByText("口令不能与账号名或仓库名相同")).toBeTruthy();
  });

  it("确认口令一致并勾选不可恢复确认后才可提交", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "absent", encryptedNotes: 0 });
    vaultApiMock.create.mockResolvedValue({ state: "unlocked", encryptedNotes: 0 });
    renderSettings();

    await screen.findByText("启用加密笔记");
    fireEvent.change(passphraseInput(), { target: { value: "correct horse battery" } });
    fireEvent.change(screen.getByLabelText("再次输入口令"), { target: { value: "correct horse batterz" } });
    expect(screen.getByText("两次输入的口令不一致")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("再次输入口令"), { target: { value: "correct horse battery" } });
    const submit = screen.getByRole("button", { name: "启用加密" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(vaultApiMock.create).toHaveBeenCalledWith("correct horse battery"));
  });

  it("已建库未解锁时提示输入口令，口令错误展示本地化文案", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "locked", encryptedNotes: 2 });
    vaultApiMock.unlock.mockRejectedValue({ code: "VAULT_9002", kind: "auth", message: "vault unlock failed", retriable: false });
    renderSettings();

    expect(await screen.findByText("解锁加密笔记")).toBeTruthy();
    fireEvent.change(passphraseInput(), { target: { value: "wrong passphrase here" } });
    fireEvent.click(screen.getByRole("button", { name: "解锁" }));

    expect(await screen.findByText("口令错误，或仓库密钥文件已损坏。")).toBeTruthy();
  });

  it("已解锁时可立即锁定", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "unlocked", encryptedNotes: 1 });
    vaultApiMock.lock.mockResolvedValue({ state: "locked", encryptedNotes: 1 });
    renderSettings();

    expect(await screen.findByText("加密笔记已解锁")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /立即锁定/ }));
    await waitFor(() => expect(vaultApiMock.lock).toHaveBeenCalled());
  });
});
