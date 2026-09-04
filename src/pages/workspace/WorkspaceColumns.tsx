import type { RefObject } from "react";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { useSidebarResizer, type SidebarResizeHandleProps } from "./useSidebarResizer";
import { NoteEditor, type NoteEditorHandle } from "@/features/note/components/NoteEditor";
import type { NoteKind } from "@/api/types";
import { useTranslation } from "@/i18n";
import { getDirectoryPath } from "@/features/file-tree/utils/path";

export interface WorkspaceColumnsProps {
  repoPath: string | null;
  currentNotePath: string | null;
  createdPath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  onSelect: (path: string) => void;
  onRequestHistory: (path: string) => void;
  historyRequestPath: string | null;
  onHistoryRequestHandled: () => void;
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onRequestImportNotes: (dir: string, files: File[]) => Promise<void>;
  onSetMove: (path: string | null) => void;
  onSetRename: (path: string | null) => void;
}

export function WorkspaceColumns({ repoPath, currentNotePath, createdPath, editorRef, onSelect, onRequestHistory, historyRequestPath, onHistoryRequestHandled, onRequestNew, onRequestFolder, onRequestImport, onRequestImportNotes, onSetMove, onSetRename }: WorkspaceColumnsProps) {
  const { t } = useTranslation();
  const { sidebarWidth, isResizing, resizeHandleProps } = useSidebarResizer();
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <WorkspaceSidebar
        repoPath={repoPath}
        onSelect={onSelect}
        onRequestNew={onRequestNew}
        onRequestFolder={onRequestFolder}
        onRequestImport={onRequestImport}
        onRequestImportNotes={onRequestImportNotes}
        createDir={currentNotePath ? getDirectoryPath(currentNotePath) : ""}
        onRequestMove={onSetMove}
        onRequestRename={onSetRename}
        onRequestHistory={onRequestHistory}
        sidebarWidth={sidebarWidth}
      />
      <SidebarDivider label={t("sidebar.resize")} isResizing={isResizing} resizeHandleProps={resizeHandleProps} />
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-bg-primary" aria-label={t("app.noteContent")}>
        <NoteEditor
          ref={editorRef}
          repoPath={repoPath}
          notePath={currentNotePath}
          onMove={onSetMove}
          onOpenNote={onSelect}
          historyRequestPath={historyRequestPath}
          onHistoryRequestHandled={onHistoryRequestHandled}
          focusTitleOnLoad={currentNotePath === createdPath}
        />
      </section>
    </div>
  );
}

function SidebarDivider({ label, isResizing, resizeHandleProps }: { label: string; isResizing: boolean; resizeHandleProps: SidebarResizeHandleProps }) {
  return <div {...resizeHandleProps} aria-label={label} className={`sidebar-resizer -ml-1 -mr-1 shrink-0 ${isResizing ? "is-resizing" : ""}`} />;
}
