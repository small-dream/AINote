import { useCallback, useMemo, useState } from "react";
import {
  useCreateFolderMutation,
  useNoteTreeQuery,
} from "@/queries/tree.queries";
import { collectDirPaths } from "../utils/path";

export interface NewFolderDialogState {
  open: boolean;
  dir: string;
}

/** 新建文件夹编排：对话框状态 + 已有目录查重 */
export function useNewFolder(repoPath: string | null) {
  const createFolder = useCreateFolderMutation();
  const { data: tree } = useNoteTreeQuery(repoPath);
  const [dialog, setDialog] = useState<NewFolderDialogState>({ open: false, dir: "" });

  const existingDirs = useMemo(() => new Set(tree ? collectDirPaths(tree) : []), [tree]);

  const requestNewFolder = useCallback((dir: string) => {
    setDialog({ open: true, dir });
  }, []);

  const close = useCallback(() => {
    setDialog({ open: false, dir: "" });
  }, []);

  const handleCreate = useCallback(
    async (path: string) => {
      await createFolder.mutateAsync(path);
      close();
    },
    [createFolder, close]
  );

  return { dialog, existingDirs, requestNewFolder, close, handleCreate };
}
