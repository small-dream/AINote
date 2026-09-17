import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useUiStore } from "@/stores/ui.store";
import type { CommandPaletteActions } from "../types";
import { CommandPalette } from "./CommandPalette";

const searchApiMock = vi.hoisted(() => ({ search: vi.fn() }));
const syncApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  commit: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  syncNow: vi.fn(),
  resolveConflict: vi.fn(),
}));
const vaultApiMock = vi.hoisted(() => ({ status: vi.fn(), lock: vi.fn(), unlock: vi.fn() }));

vi.mock("@/api", () => ({
  searchApi: searchApiMock,
  syncApi: syncApiMock,
  vaultApi: vaultApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderPalette(actions: CommandPaletteActions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette repoPath="/tmp/repo" actions={actions} />
    </QueryClientProvider>
  );
}

describe("CommandPalette vault 命令", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommandPaletteStore.setState({ open: false, query: "" });
    useUiStore.setState({ vaultDialogOpen: false, vaultAutoLock: 5 });
    syncApiMock.status.mockResolvedValue({
      ahead: 0,
      behind: 0,
      hasUncommitted: false,
      conflicted: false,
    });
  });

  it("仓库已锁定且未搜索时展示解锁命令，点击打开全局解锁弹层", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "locked", encryptedNotes: 2 });
    renderPalette({ onOpenNote: vi.fn(), onNewNote: vi.fn(), onNewFolder: vi.fn() });
    act(() => useCommandPaletteStore.getState().openPalette());

    fireEvent.click(await screen.findByText("解锁加密笔记"));
    expect(useUiStore.getState().vaultDialogOpen).toBe(true);
  });

  it("仓库已解锁时展示锁定命令，点击立即锁定", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "unlocked", encryptedNotes: 2 });
    renderPalette({ onOpenNote: vi.fn(), onNewNote: vi.fn(), onNewFolder: vi.fn() });
    act(() => useCommandPaletteStore.getState().openPalette());

    fireEvent.click(await screen.findByText("锁定加密笔记"));
    await waitFor(() => expect(vaultApiMock.lock).toHaveBeenCalled());
  });

  it("未建库时不展示 vault 命令", async () => {
    vaultApiMock.status.mockResolvedValue({ state: "absent", encryptedNotes: 0 });
    renderPalette({ onOpenNote: vi.fn(), onNewNote: vi.fn(), onNewFolder: vi.fn() });
    act(() => useCommandPaletteStore.getState().openPalette());

    expect(await screen.findByText("新建笔记")).toBeTruthy();
    expect(screen.queryByText("解锁加密笔记")).toBeNull();
    expect(screen.queryByText("锁定加密笔记")).toBeNull();
  });
});
