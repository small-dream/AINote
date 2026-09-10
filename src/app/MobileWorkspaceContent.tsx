import { useState } from "react";
import { MobileWorkspaceShell } from "@/features/mobile-shell/components/MobileWorkspaceShell";
import { WorkspaceSidebar } from "@/pages/workspace/WorkspaceSidebar";
import { NoteEditor } from "@/features/note/components/NoteEditor";
import { getDirectoryPath } from "@/features/file-tree/utils/path";
import { useSessionStore } from "@/stores/session.store";
import type { WorkspaceContentProps } from "@/pages/workspace/WorkspaceLayout";

/** 移动单栏壳组装：桌面侧栏与共享编辑器作为插槽注入 MobileWorkspaceShell。 */
export function MobileWorkspaceContent({ repoPath, currentNotePath, editorRef, actions, onSelect, historyRequestPath, setHistoryRequestPath }: WorkspaceContentProps) {
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const openNote = useSessionStore((s) => s.openNote);
  const openMobileEditor = () => setSelectionEpoch((epoch) => epoch + 1);
  const sidebar = <WorkspaceSidebar repoPath={repoPath} onSelect={(path) => { void onSelect(path); openMobileEditor(); }} onRequestNew={actions.requestNew} onRequestFolder={actions.requestNewFolder} onRequestImport={actions.importFiles} onRequestImportNotes={actions.importNotes} createDir={currentNotePath ? getDirectoryPath(currentNotePath) : ""} onRequestMove={actions.setMoveTarget} onRequestRename={actions.setRenameTarget} onRequestHistory={(path) => { setHistoryRequestPath(path); onSelect(path); }} sidebarWidth={320} />;
  const editor = <NoteEditor ref={editorRef} repoPath={repoPath} notePath={currentNotePath} onMove={actions.setMoveTarget} onOpenNote={(path) => { void onSelect(path); setSelectionEpoch((epoch) => epoch + 1); }} createdPath={actions.createdPath} historyRequestPath={historyRequestPath} onHistoryRequestHandled={() => setHistoryRequestPath(null)} focusTitleOnLoad={currentNotePath === actions.createdPath} />;
  return <MobileWorkspaceShell repoPath={repoPath} currentNotePath={currentNotePath} editorRef={editorRef} openEditorSignal={selectionEpoch} sidebar={sidebar} editor={editor} onBackToList={() => openNote(null)} />;
}
