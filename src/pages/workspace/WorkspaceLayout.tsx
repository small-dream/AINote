import { useState, type RefObject } from "react";
import { NewFolderDialog } from "@/features/file-tree/components/NewFolderDialog";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import { RenameNoteDialog } from "@/features/note/components/RenameNoteDialog";
import {
  NoteEditor,
  type NoteEditorHandle,
} from "@/features/note/components/NoteEditor";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceNavRail } from "./WorkspaceNavRail";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import { SettingsView } from "@/features/settings/components/SettingsView";
import type { WorkspaceActions } from "./useWorkspaceActions";
import { useTranslation } from "@/i18n";
import { getDirectoryPath } from "@/features/file-tree/utils/path";

interface WorkspaceLayoutProps {
  repoPath: string | null;
  startupSyncing: boolean;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  actions: WorkspaceActions;
  onSelect: (path: string) => void;
  onMoved: (to: string) => void;
}

/** 工作区三栏布局 + 新建/移动对话框（纯渲染） */
export function WorkspaceLayout({
  repoPath,
  startupSyncing,
  currentNotePath,
  editorRef,
  actions,
  onSelect,
  onMoved,
}: WorkspaceLayoutProps) {
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
          createDir={currentNotePath ? getDirectoryPath(currentNotePath) : ""}
          onSetMove={actions.setMoveTarget}
          onSetRename={actions.setRenameTarget}
        />
      </main>
      <LayoutDialogs actions={actions} onMoved={onMoved} />
      <WorkspaceOverlays repoPath={repoPath} actions={actions} editorRef={editorRef} onOpenNote={onSelect} />
    </div>
  );
}

interface WorkspaceOverlaysProps {
  repoPath: string | null;
  actions: WorkspaceActions;
  editorRef: RefObject<NoteEditorHandle | null>;
  onOpenNote: (path: string) => void;
}

/** 全局覆盖层：命令面板 + 全屏设置视图。 */
function WorkspaceOverlays({ repoPath, actions, editorRef, onOpenNote }: WorkspaceOverlaysProps) {
  return (
    <>
      <CommandPalette
        repoPath={repoPath}
        actions={{
          onOpenNote,
          onNewNote: () => { void actions.requestNew(""); },
          onNewFolder: () => actions.requestNewFolder(""),
          onChangeMode: (mode) => editorRef.current?.setMode(mode),
          onInsertCallout: () => editorRef.current?.insertCallout(),
        }}
      />
      <SettingsView />
    </>
  );
}

interface WorkspaceColumnsProps {
  repoPath: string | null;
  currentNotePath: string | null;
  createdPath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  onSelect: (path: string) => void;
  onRequestHistory: (path: string) => void;
  historyRequestPath: string | null;
  onHistoryRequestHandled: () => void;
  onRequestNew: (dir: string, kind?: import("@/api/types").NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onRequestImportNotes: (dir: string, files: File[]) => Promise<void>;
  createDir: string;
  onSetMove: (path: string | null) => void;
  onSetRename: (path: string | null) => void;
}

function WorkspaceColumns({
  repoPath,
  currentNotePath,
  createdPath,
  editorRef,
  onSelect,
  onRequestHistory,
  historyRequestPath,
  onHistoryRequestHandled,
  onRequestNew,
  onRequestFolder,
  onRequestImport,
  onRequestImportNotes,
  createDir,
  onSetMove,
  onSetRename,
}: WorkspaceColumnsProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <WorkspaceSidebar
        repoPath={repoPath}
        onSelect={onSelect}
        onRequestNew={onRequestNew}
        onRequestFolder={onRequestFolder}
        onRequestImport={onRequestImport}
        onRequestImportNotes={onRequestImportNotes}
        createDir={createDir}
        onRequestMove={onSetMove}
        onRequestRename={onSetRename}
        onRequestHistory={onRequestHistory}
      />
      <EditorPane repoPath={repoPath} currentNotePath={currentNotePath} createdPath={createdPath} editorRef={editorRef} onSelect={onSelect} onSetMove={onSetMove} historyRequestPath={historyRequestPath} onHistoryRequestHandled={onHistoryRequestHandled} />
    </div>
  );
}

interface EditorPaneProps {
  repoPath: string | null;
  currentNotePath: string | null;
  createdPath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  onSelect: (path: string) => void;
  onSetMove: (path: string | null) => void;
  historyRequestPath: string | null;
  onHistoryRequestHandled: () => void;
}

function EditorPane({ repoPath, currentNotePath, createdPath, editorRef, onSelect, onSetMove, historyRequestPath, onHistoryRequestHandled }: EditorPaneProps) {
  const { t } = useTranslation();
  return <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary" aria-label={t("app.noteContent")}>
    <NoteEditor ref={editorRef} repoPath={repoPath} notePath={currentNotePath} onMove={onSetMove} onOpenNote={onSelect} historyRequestPath={historyRequestPath} onHistoryRequestHandled={onHistoryRequestHandled} focusTitleOnLoad={currentNotePath === createdPath} />
  </section>;
}

interface LayoutDialogsProps {
  actions: WorkspaceActions;
  onMoved: (to: string) => void;
}

function LayoutDialogs({ actions, onMoved }: LayoutDialogsProps) {
  return (
    <>
      <NewFolderDialog
        key={actions.folderDialog.open ? actions.folderDialog.dir : "closed"}
        open={actions.folderDialog.open}
        dir={actions.folderDialog.dir}
        existingDirs={actions.existingDirs}
        onClose={actions.closeFolder}
        onCreate={actions.handleCreateFolder}
      />
      <MoveNoteDialog
        key={actions.moveTarget ?? "none"}
        path={actions.moveTarget}
        onClose={() => actions.setMoveTarget(null)}
        onMoved={onMoved}
      />
      <RenameNoteDialog
        key={actions.renameTarget ?? "none"}
        path={actions.renameTarget}
        onClose={() => actions.setRenameTarget(null)}
        onRenamed={onMoved}
      />
    </>
  );
}
