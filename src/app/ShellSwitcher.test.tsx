import type { RefObject } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShellSwitcher } from "./ShellSwitcher";
import type { WorkspaceActions } from "@/pages/workspace/useWorkspaceActions";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";

const viewport = vi.hoisted(() => ({ isMobile: false }));
const vaultApiMock = vi.hoisted(() => ({ status: vi.fn() }));

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
vi.mock("@/api", () => ({ vaultApi: vaultApiMock }));

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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WorkspaceShellSwitcher
        repoPath="/repo"
        startupSyncing={false}
        currentNotePath={null}
        editorRef={editorRef}
        actions={actions}
        onSelect={vi.fn()}
        onMoved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("WorkspaceShellSwitcher", () => {
  beforeEach(() => {
    viewport.isMobile = false;
    vaultApiMock.status.mockResolvedValue({ state: "absent", encryptedNotes: 0 });
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
