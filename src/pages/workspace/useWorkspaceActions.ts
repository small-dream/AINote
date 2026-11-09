import { useState } from "react";
import type { NewFolderDialogState } from "@/features/file-tree/hooks/useNewFolder";
import { useNewFolder } from "@/features/file-tree/hooks/useNewFolder";
import type { CreateNote } from "@/features/note/hooks/useNewNote";
import { useNewNote } from "@/features/note/hooks/useNewNote";
import { useImportAssetBytesMutation } from "@/queries/asset.queries";
import { useImportNoteMutation } from "@/queries/note.queries";
import type { NoteMeta } from "@/api/types";
import { useTranslation } from "@/i18n";
import { isMobileApp } from "@/platform/runtime";
import { useDocumentImport, type DocumentImportController } from "@/features/document-import/hooks/useDocumentImport";
import { DocumentImportError } from "@/features/document-import/types";
import { selectNoteImport } from "@/features/document-import/utils/selection";

export interface WorkspaceActions {
  existingPaths: ReadonlySet<string>;
  createdPath: string | null;
  requestNew: CreateNote;
  importFiles: (files: File[]) => Promise<void>;
  importNotes: (dir: string, files: File[]) => Promise<void>;
  documentImport: DocumentImportController;
  folderDialog: NewFolderDialogState;
  existingDirs: ReadonlySet<string>;
  requestNewFolder: (dir: string) => void;
  closeFolder: () => void;
  handleCreateFolder: (path: string) => Promise<void>;
  moveTarget: string | null;
  setMoveTarget: (path: string | null) => void;
  renameTarget: string | null;
  setRenameTarget: (path: string | null) => void;
}

/** 工作区「新建笔记 / 新建文件夹 / 移动」三组编排的聚合 */
export function useWorkspaceActions(repoPath: string | null, onOpen: (path: string) => void) {
  const { t } = useTranslation();
  const newNote = useNewNote(repoPath, onOpen);
  const newFolder = useNewFolder(repoPath);
  const importAsset = useImportAssetBytesMutation();
  const importNote = useImportNoteMutation();
  const documentImport = useDocumentImport(onOpen);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

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
    importNotes: async (dir: string, files: File[]) => {
      const selection = selectNoteImport(files, isMobileApp());
      if (selection.kind === "invalid") {
        const messages = {
          unsupported: "importDoc.errorUnsupported",
          oneAtATime: "importDoc.oneAtATime",
          desktopOnly: "importDoc.errorDesktopOnly",
        } as const;
        const code = selection.code === "oneAtATime" ? "unsupported" : selection.code;
        throw new DocumentImportError(code, t(messages[selection.code]));
      }
      if (selection.kind === "document") {
        await documentImport.start(dir, selection.file);
        return;
      }
      let last: NoteMeta | undefined;
      for (const file of selection.files) {
        const content = await file.text();
        last = await importNote.mutateAsync({ dir, fileName: file.name, content });
      }
      if (last) onOpen(last.path);
    },
    folderDialog: newFolder.dialog,
    existingDirs: newFolder.existingDirs,
    requestNewFolder: newFolder.requestNewFolder,
    closeFolder: newFolder.close,
    handleCreateFolder: newFolder.handleCreate,
    moveTarget,
    setMoveTarget,
    renameTarget,
    setRenameTarget,
    documentImport,
  };
}
