import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
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

vi.mock("@/api", () => ({
  searchApi: searchApiMock,
  syncApi: syncApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const RESULT = {
  path: "daily/foo.md",
  title: "Foo",
  snippet: "hello rust world",
  line: 1,
  updatedAt: 1,
};

function renderPalette(actions: CommandPaletteActions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette repoPath="/tmp/repo" actions={actions} />
    </QueryClientProvider>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCommandPaletteStore.setState({ open: false });
    syncApiMock.status.mockResolvedValue({
      ahead: 0,
      behind: 0,
      hasUncommitted: false,
      conflicted: false,
    });
  });

  it("Cmd+K 打开面板并聚焦搜索框", () => {
    renderPalette({ onOpenNote: vi.fn(), onNewNote: vi.fn(), onNewFolder: vi.fn() });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText("输入命令或搜索笔记…")).toBeTruthy();
  });

  it("输入查询展示搜索结果，点击可打开笔记", async () => {
    const onOpenNote = vi.fn();
    searchApiMock.search.mockResolvedValue([RESULT]);
    renderPalette({ onOpenNote, onNewNote: vi.fn(), onNewFolder: vi.fn() });
    useCommandPaletteStore.setState({ open: true });

    fireEvent.change(await screen.findByPlaceholderText("输入命令或搜索笔记…"), {
      target: { value: "rust" },
    });
    expect(await screen.findByText("Foo")).toBeTruthy();
    fireEvent.click(screen.getByText("Foo"));
    expect(onOpenNote).toHaveBeenCalledWith("daily/foo.md");
  });

  it("空查询展示动作命令，点击执行新建笔记", async () => {
    const onNewNote = vi.fn();
    renderPalette({ onOpenNote: vi.fn(), onNewNote, onNewFolder: vi.fn() });
    useCommandPaletteStore.setState({ open: true });

    fireEvent.click(await screen.findByText("新建笔记"));
    expect(onNewNote).toHaveBeenCalled();
  });
});
