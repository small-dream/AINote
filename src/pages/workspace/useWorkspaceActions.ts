import { useState } from "react";
import type { NewFolderDialogState } from "@/features/file-tree/hooks/useNewFolder";
import { useNewFolder } from "@/features/file-tree/hooks/useNewFolder";
import type { NewNoteDialogState } from "@/features/note/hooks/useNewNote";
import { useNewNote } from "@/features/note/hooks/useNewNote";
import type { NewNoteInput } from "@/features/note/types";

export interface WorkspaceActions {
  dialog: NewNoteDialogState;
  existingPaths: ReadonlySet<string>;
  createdPath: string | null;
  requestNew: (dir: string) => void;
  closeNew: () => void;
  handleCreate: (input: NewNoteInput) => Promise<void>;
  folderDialog: NewFolderDialogState;
  existingDirs: ReadonlySet<string>;
  requestNewFolder: (dir: string) => void;
  closeFolder: () => void;
  handleCreateFolder: (path: string) => Promise<void>;
  moveTarget: string | null;
  setMoveTarget: (path: string | null) => void;
}

/** 工作区「新建笔记 / 新建文件夹 / 移动」三组编排的聚合 */
export function useWorkspaceActions(repoPath: string | null, onOpen: (path: string) => void) {
  const newNote = useNewNote(repoPath, onOpen);
  const newFolder = useNewFolder(repoPath);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  return {
    dialog: newNote.dialog,
    existingPaths: newNote.existingPaths,
    createdPath: newNote.createdPath,
    requestNew: newNote.requestNew,
    closeNew: newNote.close,
    handleCreate: newNote.handleCreate,
    folderDialog: newFolder.dialog,
    existingDirs: newFolder.existingDirs,
    requestNewFolder: newFolder.requestNewFolder,
    closeFolder: newFolder.close,
    handleCreateFolder: newFolder.handleCreate,
    moveTarget,
    setMoveTarget,
  };
}
