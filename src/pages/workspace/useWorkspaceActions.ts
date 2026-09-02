import { useState } from "react";
import type { NewFolderDialogState } from "@/features/file-tree/hooks/useNewFolder";
import { useNewFolder } from "@/features/file-tree/hooks/useNewFolder";
import type { CreateNote } from "@/features/note/hooks/useNewNote";
import { useNewNote } from "@/features/note/hooks/useNewNote";
import { useImportAssetBytesMutation } from "@/queries/asset.queries";

export interface WorkspaceActions {
  existingPaths: ReadonlySet<string>;
  createdPath: string | null;
  requestNew: CreateNote;
  importFiles: (files: File[]) => Promise<void>;
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
  const importAsset = useImportAssetBytesMutation();
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  return {
    existingPaths: newNote.existingPaths,
    createdPath: newNote.createdPath,
    requestNew: newNote.requestNew,
    importFiles: async (files: File[]) => {
      await Promise.all(
        files.map(async (file) => {
          const bytes = new Uint8Array(await file.arrayBuffer());
          await importAsset.mutateAsync({ bytes, fileName: file.name });
        }),
      );
    },
    folderDialog: newFolder.dialog,
    existingDirs: newFolder.existingDirs,
    requestNewFolder: newFolder.requestNewFolder,
    closeFolder: newFolder.close,
    handleCreateFolder: newFolder.handleCreate,
    moveTarget,
    setMoveTarget,
  };
}
