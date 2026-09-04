import { useState, type RefObject } from "react";
import { NewFolderDialog } from "@/features/file-tree/components/NewFolderDialog";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import { RenameNoteDialog } from "@/features/note/components/RenameNoteDialog";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { WorkspaceNavRail } from "./WorkspaceNavRail";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import { SettingsView } from "@/features/settings/components/SettingsView";
import type { WorkspaceActions } from "./useWorkspaceActions";
import { WorkspaceColumns } from "./WorkspaceColumns";

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
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-bg-tertiary/55">
      <WorkspaceNavRail repoPath={repoPath} startupSyncing={startupSyncing} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary">
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
      </main>
      <LayoutDialogs repoPath={repoPath} actions={actions} onMoved={onMoved} />
      <WorkspaceOverlays repoPath={repoPath} actions={actions} editorRef={editorRef} onOpenNote={onSelect} />
    </div>
  );
}

function LayoutDialogs({ repoPath, actions, onMoved }: { repoPath: string | null; actions: WorkspaceActions; onMoved: (path: string) => void }) {
  return <>
    <NewFolderDialog key={actions.folderDialog.open ? actions.folderDialog.dir : "closed"} open={actions.folderDialog.open} dir={actions.folderDialog.dir} existingDirs={actions.existingDirs} onClose={actions.closeFolder} onCreate={actions.handleCreateFolder} />
    <MoveNoteDialog key={actions.moveTarget ?? "none"} repoPath={repoPath} path={actions.moveTarget} onClose={() => actions.setMoveTarget(null)} onMoved={onMoved} />
    <RenameNoteDialog key={actions.renameTarget ?? "none"} path={actions.renameTarget} onClose={() => actions.setRenameTarget(null)} onRenamed={onMoved} />
  </>;
}

function WorkspaceOverlays({ repoPath, actions, editorRef, onOpenNote }: { repoPath: string | null; actions: WorkspaceActions; editorRef: RefObject<NoteEditorHandle | null>; onOpenNote: (path: string) => void }) {
  return <>
    <CommandPalette repoPath={repoPath} actions={{ onOpenNote, onNewNote: () => { void actions.requestNew(""); }, onNewFolder: () => actions.requestNewFolder(""), onChangeMode: (mode) => editorRef.current?.setMode(mode), onInsertCallout: () => editorRef.current?.insertCallout() }} />
    <SettingsView />
  </>;
}
