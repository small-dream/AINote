import { lazy, Suspense, useState, type RefObject } from "react";
import { NewFolderDialog } from "@/features/file-tree/components/NewFolderDialog";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import { RenameNoteDialog } from "@/features/note/components/RenameNoteDialog";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import { WorkspaceLayout } from "@/pages/workspace/WorkspaceLayout";
import type { WorkspaceActions } from "@/pages/workspace/useWorkspaceActions";
import { useUiStore } from "@/stores/ui.store";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { MobileWorkspaceContent } from "./MobileWorkspaceContent";

const LazySettingsView = lazy(() => import("@/features/settings/components/SettingsView").then(({ SettingsView }) => ({ default: SettingsView })));
const LazyCommitDialog = lazy(() => import("@/features/commit/components/CommitDialog").then(({ CommitDialog }) => ({ default: CommitDialog })));
const LazyGitGraphPanel = lazy(() => import("@/features/git-graph/components/GitGraphPanel").then(({ GitGraphPanel }) => ({ default: GitGraphPanel })));

export interface WorkspaceShellProps {
  repoPath: string | null;
  startupSyncing: boolean;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  actions: WorkspaceActions;
  onSelect: (path: string) => void;
  onMoved: (to: string) => void;
}

/** 壳切换：组装层唯一的双壳交汇点，按视口选择桌面三栏壳或移动单栏壳（双壳互不 import）。 */
export function WorkspaceShellSwitcher({ repoPath, startupSyncing, currentNotePath, editorRef, actions, onSelect, onMoved }: WorkspaceShellProps) {
  const [historyRequestPath, setHistoryRequestPath] = useState<string | null>(null);
  const noteTheme = useUiStore((state) => state.noteTheme);
  const noteThemeScope = useUiStore((state) => state.noteThemeScope);
  const isMobile = useIsMobileViewport();
  const content = { repoPath, currentNotePath, editorRef, actions, onSelect, historyRequestPath, setHistoryRequestPath };
  return (
    <div className={`workspace-shell flex h-dvh min-h-0 overflow-hidden bg-bg-tertiary ${noteThemeScope === "workspace" ? "workspace-theme-linked" : ""}`} data-note-theme={noteThemeScope === "workspace" ? noteTheme : undefined}>
      {isMobile ? <MobileWorkspaceContent {...content} /> : <WorkspaceLayout {...content} startupSyncing={startupSyncing} />}
      <WorkspaceDialogs repoPath={repoPath} actions={actions} onMoved={onMoved} />
      <WorkspaceOverlays repoPath={repoPath} actions={actions} editorRef={editorRef} onOpenNote={onSelect} />
    </div>
  );
}

function WorkspaceDialogs({ repoPath, actions, onMoved }: { repoPath: string | null; actions: WorkspaceActions; onMoved: (path: string) => void }) {
  return <>
    <NewFolderDialog key={`new-folder:${actions.folderDialog.open ? actions.folderDialog.dir : "closed"}`} open={actions.folderDialog.open} dir={actions.folderDialog.dir} existingDirs={actions.existingDirs} onClose={actions.closeFolder} onCreate={actions.handleCreateFolder} />
    <MoveNoteDialog key={`move:${actions.moveTarget ?? "none"}`} repoPath={repoPath} path={actions.moveTarget} onClose={() => actions.setMoveTarget(null)} onMoved={onMoved} />
    <RenameNoteDialog key={`rename:${actions.renameTarget ?? "none"}`} path={actions.renameTarget} onClose={() => actions.setRenameTarget(null)} onRenamed={onMoved} />
  </>;
}

function WorkspaceOverlays({ repoPath, actions, editorRef, onOpenNote }: { repoPath: string | null; actions: WorkspaceActions; editorRef: RefObject<NoteEditorHandle | null>; onOpenNote: (path: string) => void }) {
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const [commitOpen, setCommitOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  return <>
    <CommandPalette repoPath={repoPath} actions={{ onOpenNote, onNewNote: () => { void actions.requestNew(""); }, onNewFolder: () => actions.requestNewFolder(""), onChangeMode: (mode) => editorRef.current?.setMode(mode), onInsertCallout: () => editorRef.current?.insertCallout(), onRequestCommit: () => setCommitOpen(true), onRequestGraph: () => setGraphOpen(true) }} />
    <Suspense fallback={null}>{settingsOpen ? <LazySettingsView /> : null}</Suspense>
    {commitOpen ? (
      <Suspense fallback={null}>
        <LazyCommitDialog repoPath={repoPath} onClose={() => setCommitOpen(false)} />
      </Suspense>
    ) : null}
    {graphOpen ? (
      <Suspense fallback={null}>
        <LazyGitGraphPanel repoPath={repoPath} open onClose={() => setGraphOpen(false)} />
      </Suspense>
    ) : null}
  </>;
}
