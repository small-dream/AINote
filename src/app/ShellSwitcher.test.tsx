import type { RefObject } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShellSwitcher } from "./ShellSwitcher";
import type { WorkspaceActions } from "@/pages/workspace/useWorkspaceActions";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/hooks/useIsMobileViewport", () => ({
  useIsMobileViewport: () => viewport.isMobile,
}));

vi.mock("@/pages/workspace/WorkspaceLayout", () => ({
  WorkspaceLayout: () => <div data-testid="desktop-shell" />,
}));

vi.mock("./MobileWorkspaceContent", () => ({
  MobileWorkspaceContent: () => <div data-testid="mobile-shell" />,
}));

vi.mock("@/features/file-tree/components/NewFolderDialog", () => ({ NewFolderDialog: () => null }));
vi.mock("@/features/note/components/MoveNoteDialog", () => ({ MoveNoteDialog: () => null }));
vi.mock("@/features/note/components/RenameNoteDialog", () => ({ RenameNoteDialog: () => null }));
vi.mock("@/features/search/components/CommandPalette", () => ({ CommandPalette: () => null }));

const actions = {
  folderDialog: { open: false, dir: "" },
  existingDirs: new Set<string>(),
  moveTarget: null,
  renameTarget: null,
  createdPath: null,
  requestNew: vi.fn(),
  requestNewFolder: vi.fn(),
  importFiles: vi.fn(),
  importNotes: vi.fn(),
  setMoveTarget: vi.fn(),
  setRenameTarget: vi.fn(),
  closeFolder: vi.fn(),
  handleCreateFolder: vi.fn(),
} as unknown as WorkspaceActions;

function renderSwitcher() {
  const editorRef = { current: null } as RefObject<NoteEditorHandle | null>;
  return render(
    <WorkspaceShellSwitcher
      repoPath="/repo"
      startupSyncing={false}
      currentNotePath={null}
      editorRef={editorRef}
      actions={actions}
      onSelect={vi.fn()}
      onMoved={vi.fn()}
    />,
  );
}

describe("WorkspaceShellSwitcher", () => {
  beforeEach(() => {
    viewport.isMobile = false;
  });

  it("桌面视口渲染桌面三栏壳", () => {
    renderSwitcher();
    expect(screen.getByTestId("desktop-shell")).toBeTruthy();
    expect(screen.queryByTestId("mobile-shell")).toBeNull();
  });

  it("移动视口渲染移动单栏壳", () => {
    viewport.isMobile = true;
    renderSwitcher();
    expect(screen.getByTestId("mobile-shell")).toBeTruthy();
    expect(screen.queryByTestId("desktop-shell")).toBeNull();
  });
});
