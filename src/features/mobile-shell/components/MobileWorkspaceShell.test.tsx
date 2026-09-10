import type { RefObject } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileWorkspaceShell } from "./MobileWorkspaceShell";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useSessionStore } from "@/stores/session.store";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useUiStore } from "@/stores/ui.store";

const useSyncMock = vi.fn();

vi.mock("@/features/sync/hooks/useSync", () => ({
  useSync: (...args: Parameters<typeof import("@/features/sync/hooks/useSync")["useSync"]>) => useSyncMock(...args),
}));

vi.mock("@/features/sync/components/ConflictMergeDialog", () => ({
  ConflictMergeDialog: ({ open }: { open: boolean }) => (open ? <div>mobile-conflict-dialog</div> : null),
}));

useSyncMock.mockReturnValue({
    online: true,
    status: { conflicted: false, hasUncommitted: false },
    label: { text: "已同步", tone: "synced" },
    syncNow: { mutate: vi.fn() },
    isSyncing: false,
});

const flush = vi.fn().mockResolvedValue(undefined);
const editorRef = { current: { flush, setMode: vi.fn(), openHistory: vi.fn(), insertCallout: vi.fn() } } as unknown as RefObject<NoteEditorHandle>;

  function renderShell({ currentNotePath = null, openEditorSignal = 0 }: { currentNotePath?: string | null; openEditorSignal?: number } = {}) {
  return render(
    <MobileWorkspaceShell
      repoPath="/mock-repo"
      currentNotePath={currentNotePath}
      editorRef={editorRef}
      openEditorSignal={openEditorSignal}
      sidebar={<div>mobile-list</div>}
      editor={<div>mobile-editor</div>}
      onBackToList={() => undefined}
    />,
  );
}

describe("MobileWorkspaceShell", () => {
  beforeEach(() => {
    useSessionStore.setState({ repoPath: "/mock-repo", currentNotePath: null });
    useUiStore.setState({ sidebarTab: "tree" });
    useCommandPaletteStore.setState({ open: false, query: "", selected: 0 });
    window.history.replaceState({}, "");
    vi.clearAllMocks();
  });

  it("opens the editor when a note is selected", () => {
    const { rerender } = renderShell();
    expect(screen.getByText("mobile-list")).toBeTruthy();
    expect(screen.queryByText("mobile-editor")).toBeNull();
    rerender(
      <MobileWorkspaceShell
        repoPath="/mock-repo"
        currentNotePath="Product/note.md"
        editorRef={editorRef}
        openEditorSignal={1}
        sidebar={<div>mobile-list</div>}
        editor={<div>mobile-editor</div>}
        onBackToList={vi.fn()}
      />,
    );
    expect(screen.getByText("mobile-editor")).toBeTruthy();
    expect(screen.queryByText("mobile-list")).toBeNull();
  });

  it("returns to the list and flushes the editor", () => {
    renderShell({ currentNotePath: "Product/note.md", openEditorSignal: 1 });
    expect(screen.getByText("mobile-editor")).toBeTruthy();
    screen.getByRole("button", { name: "返回列表" }).click();
    expect(editorRef.current?.flush).toHaveBeenCalled();
  });

  it("shows list filters and opens the command palette", () => {
    renderShell();
    screen.getByRole("tab", { name: "标签" }).click();
    expect(useUiStore.getState().sidebarTab).toBe("tags");
    screen.getByRole("button", { name: "搜索" }).click();
    expect(useCommandPaletteStore.getState().open).toBe(true);
  });

  it("opens the conflict resolver from the sync pill", async () => {
    useSyncMock.mockReturnValue({
      online: true,
      status: { conflicted: true, hasUncommitted: false },
      label: { text: "存在冲突", tone: "conflict" },
      syncNow: { mutate: vi.fn() },
      isSyncing: false,
    });
    renderShell();
    screen.getByRole("button", { name: "存在冲突" }).click();
    await waitFor(() => expect(screen.getByText("mobile-conflict-dialog")).toBeTruthy());
  });
});

describe("MobileWorkspaceShell / 同步失败", () => {
  it("移动端同步失败时展示阶段、原因与重试入口", () => {
    useSyncMock.mockReturnValue({
      online: true,
      status: { conflicted: false, hasUncommitted: false },
      label: { text: "已同步", tone: "synced" },
      syncNow: {
        mutate: vi.fn(),
        error: { code: "SYNC_4002", kind: "network", message: "连接超时", retriable: true },
      },
      isSyncing: false,
    });
    renderShell();
    expect(screen.getByRole("alert").textContent).toContain("同步失败 · 拉取 / 推送阶段");
    expect(screen.getByText("连接超时")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试同步" })).toBeTruthy();
  });
});
