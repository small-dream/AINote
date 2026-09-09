import type { RefObject } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileWorkspaceShell } from "./MobileWorkspaceShell";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useSessionStore } from "@/stores/session.store";

vi.mock("@/features/sync/hooks/useSync", () => ({
  useSync: vi.fn(() => ({
    online: true,
    status: { conflicted: false, hasUncommitted: false },
    label: { text: "已同步", tone: "synced" },
    syncNow: { mutate: vi.fn() },
    isSyncing: false,
  })),
}));

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
});
