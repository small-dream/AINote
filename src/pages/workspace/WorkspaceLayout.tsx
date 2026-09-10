import { lazy, Suspense, useState, type RefObject } from "react";
import { NewFolderDialog } from "@/features/file-tree/components/NewFolderDialog";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import { RenameNoteDialog } from "@/features/note/components/RenameNoteDialog";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { WorkspaceNavRail } from "./WorkspaceNavRail";
import type { WorkspaceActions } from "./useWorkspaceActions";
import { WorkspaceColumns } from "./WorkspaceColumns";
import { useSync } from "@/features/sync/hooks/useSync";
import { SyncNotice } from "@/features/sync/components/SyncNotice";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import { useUiStore } from "@/stores/ui.store";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { MobileWorkspaceShell } from "@/features/mobile-shell/components/MobileWorkspaceShell";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { NoteEditor } from "@/features/note/components/NoteEditor";
import { getDirectoryPath } from "@/features/file-tree/utils/path";
import { useSessionStore } from "@/stores/session.store";

const LazySettingsView = lazy(() => import("@/features/settings/components/SettingsView").then(({ SettingsView }) => ({ default: SettingsView })));
const LazyCommitDialog = lazy(() => import("@/features/commit/components/CommitDialog").then(({ CommitDialog }) => ({ default: CommitDialog })));
const LazyGitGraphPanel = lazy(() => import("@/features/git-graph/components/GitGraphPanel").then(({ GitGraphPanel }) => ({ default: GitGraphPanel })));

interface WorkspaceLayoutProps {
  repoPath: string | null;
  startupSyncing: boolean;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  actions: WorkspaceActions;
  onSelect: (path: string) => void;
  onMoved: (to: string) => void;
}

/** 工作区三栏布局与全局对话框/覆盖层的装配入口。 */
export function WorkspaceLayout({ repoPath, startupSyncing, currentNotePath, editorRef, actions, onSelect, onMoved }: WorkspaceLayoutProps) {
  const [historyRequestPath, setHistoryRequestPath] = useState<string | null>(null);
  const noteTheme = useUiStore((state) => state.noteTheme);
  const noteThemeScope = useUiStore((state) => state.noteThemeScope);
  const isMobile = useIsMobileViewport();
  return (
    <div className={`workspace-shell flex h-dvh min-h-0 overflow-hidden bg-bg-tertiary ${noteThemeScope === "workspace" ? "workspace-theme-linked" : ""}`} data-note-theme={noteThemeScope === "workspace" ? noteTheme : undefined}>
      {isMobile ? <MobileContent repoPath={repoPath} currentNotePath={currentNotePath} editorRef={editorRef} actions={actions} onSelect={onSelect} historyRequestPath={historyRequestPath} setHistoryRequestPath={setHistoryRequestPath} /> : <DesktopContent repoPath={repoPath} startupSyncing={startupSyncing} currentNotePath={currentNotePath} editorRef={editorRef} actions={actions} onSelect={onSelect} historyRequestPath={historyRequestPath} setHistoryRequestPath={setHistoryRequestPath} />}
      <LayoutDialogs repoPath={repoPath} actions={actions} onMoved={onMoved} />
      <WorkspaceOverlays repoPath={repoPath} actions={actions} editorRef={editorRef} onOpenNote={onSelect} />
    </div>
  );
}

type ContentProps = {
  repoPath: string | null;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  actions: WorkspaceActions;
  onSelect: (path: string) => void;
  historyRequestPath: string | null;
  setHistoryRequestPath: (path: string | null) => void;
};

/** 桌面三栏：同步编排在此持有单一实例，导航轨与失败横幅共享同一份失败态。 */
function DesktopContent({ repoPath, startupSyncing, currentNotePath, editorRef, actions, onSelect, historyRequestPath, setHistoryRequestPath }: ContentProps & { startupSyncing: boolean }) {
  const sync = useSync(repoPath);
  return <>
    <WorkspaceNavRail repoPath={repoPath} startupSyncing={startupSyncing} sync={sync} />
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-primary">
      <SyncNotice sync={sync} />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <WorkspaceColumns
          repoPath={repoPath}
          currentNotePath={currentNotePath}
          createdPath={actions.createdPath}
          editorRef={editorRef}
          onSelect={onSelect}
          onRequestHistory={(path) => { setHistoryRequestPath(path); onSelect(path); }}
          historyRequestPath={historyRequestPath}
          onHistoryRequestHandled={() => setHistoryRequestPath(null)}
          onRequestNew={actions.requestNew}
          onRequestFolder={actions.requestNewFolder}
          onRequestImport={actions.importFiles}
          onRequestImportNotes={actions.importNotes}
          onSetMove={actions.setMoveTarget}
          onSetRename={actions.setRenameTarget}
        />
      </div>
    </main>
  </>;
}

function MobileContent({ repoPath, currentNotePath, editorRef, actions, onSelect, historyRequestPath, setHistoryRequestPath }: ContentProps) {
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const openNote = useSessionStore((s) => s.openNote);
  const openMobileEditor = () => setSelectionEpoch((epoch) => epoch + 1);
  const sidebar = <WorkspaceSidebar repoPath={repoPath} onSelect={(path) => { void onSelect(path); openMobileEditor(); }} onRequestNew={actions.requestNew} onRequestFolder={actions.requestNewFolder} onRequestImport={actions.importFiles} onRequestImportNotes={actions.importNotes} createDir={currentNotePath ? getDirectoryPath(currentNotePath) : ""} onRequestMove={actions.setMoveTarget} onRequestRename={actions.setRenameTarget} onRequestHistory={(path) => { setHistoryRequestPath(path); onSelect(path); }} sidebarWidth={320} />;
  const editor = <NoteEditor ref={editorRef} repoPath={repoPath} notePath={currentNotePath} onMove={actions.setMoveTarget} onOpenNote={(path) => { void onSelect(path); setSelectionEpoch((epoch) => epoch + 1); }} createdPath={actions.createdPath} historyRequestPath={historyRequestPath} onHistoryRequestHandled={() => setHistoryRequestPath(null)} focusTitleOnLoad={currentNotePath === actions.createdPath} />;
  return <MobileWorkspaceShell repoPath={repoPath} currentNotePath={currentNotePath} editorRef={editorRef} openEditorSignal={selectionEpoch} sidebar={sidebar} editor={editor} onBackToList={() => openNote(null)} />;
}

function LayoutDialogs({ repoPath, actions, onMoved }: { repoPath: string | null; actions: WorkspaceActions; onMoved: (path: string) => void }) {
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
