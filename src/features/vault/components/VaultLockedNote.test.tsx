import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { VaultLockedNote } from "./VaultLockedNote";

const vaultApiMock = vi.hoisted(() => ({ status: vi.fn(), unlock: vi.fn() }));
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

function renderLocked() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VaultLockedNote notePath="sub/secret.md" />
    </QueryClientProvider>
  );
}

describe("VaultLockedNote", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/repo/notes", currentNotePath: null, login: null });
    useUiStore.setState({ settingsOpen: false, settingsTab: "repositories" });
    vaultApiMock.status.mockResolvedValue({ state: "locked", encryptedNotes: 1 });
  });

  it("锁定态编辑区内嵌解锁表单，不渲染任何正文", async () => {
    renderLocked();

    expect(screen.getByText("这篇笔记已加密")).toBeTruthy();
    expect(screen.getByText(/sub\/secret\.md/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "解锁" })).toBeTruthy();
  });

  it("就地输入口令解锁，口令只透传给 Rust", async () => {
    vaultApiMock.unlock.mockResolvedValue({ state: "unlocked", encryptedNotes: 1 });
    renderLocked();

    const input = (await screen.findByLabelText("仓库口令")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: "解锁" }));

    await waitFor(() => expect(vaultApiMock.unlock).toHaveBeenCalledWith("correct horse battery"));
  });

  it("保留设置页管理入口", async () => {
    renderLocked();

    fireEvent.click(await screen.findByRole("button", { name: "在设置中管理" }));
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsTab).toBe("vault");
  });
});
