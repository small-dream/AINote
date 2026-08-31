import type { RefObject } from "react";
import { NewFolderDialog } from "@/features/file-tree/components/NewFolderDialog";
import { NewNoteDialog } from "@/features/note/components/NewNoteDialog";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import {
  NoteEditor,
  type NoteEditorHandle,
} from "@/features/note/components/NoteEditor";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceNavRail } from "./WorkspaceNavRail";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import type { WorkspaceActions } from "./useWorkspaceActions";
import { useTranslation } from "@/i18n";

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
          onRequestNew={actions.requestNew}
          onRequestFolder={actions.requestNewFolder}
          onSetMove={actions.setMoveTarget}
        />
      </main>
      <LayoutDialogs actions={actions} onMoved={onMoved} />
      <CommandPalette
        repoPath={repoPath}
        actions={{
          onOpenNote: onSelect,
          onNewNote: () => actions.requestNew(""),
          onNewFolder: () => actions.requestNewFolder(""),
        }}
      />
    </div>
  );
}

interface WorkspaceColumnsProps {
  repoPath: string | null;
  currentNotePath: string | null;
  createdPath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onSetMove: (path: string | null) => void;
}

function WorkspaceColumns({
  repoPath,
  currentNotePath,
  createdPath,
  editorRef,
  onSelect,
  onRequestNew,
  onRequestFolder,
  onSetMove,
}: WorkspaceColumnsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <WorkspaceSidebar
        repoPath={repoPath}
        onSelect={onSelect}
        onRequestNew={onRequestNew}
        onRequestFolder={onRequestFolder}
        onRequestMove={onSetMove}
      />
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary" aria-label={t("app.noteContent")}>
        <NoteEditor
          ref={editorRef}
          repoPath={repoPath}
          notePath={currentNotePath}
          onMove={onSetMove}
          focusTitleOnLoad={currentNotePath === createdPath}
        />
      </section>
    </div>
  );
}

interface LayoutDialogsProps {
  actions: WorkspaceActions;
  onMoved: (to: string) => void;
}

function LayoutDialogs({ actions, onMoved }: LayoutDialogsProps) {
  return (
    <>
      <NewNoteDialog
        key={actions.dialog.open ? actions.dialog.dir : "closed"}
        open={actions.dialog.open}
        dir={actions.dialog.dir}
        existingPaths={actions.existingPaths}
        onClose={actions.closeNew}
        onCreate={actions.handleCreate}
      />
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
    </>
  );
}
