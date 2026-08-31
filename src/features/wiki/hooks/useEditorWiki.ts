import { useCallback, useState } from "react";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import { resolveWikiTarget } from "../utils/wiki";

/** 编辑器双链交互：面板开关 + `[[name]]` 点击 → 打开目标或展开面板（未创建） */
export function useEditorWiki(repoPath: string | null, onOpenNote: (path: string) => void) {
  const [open, setOpen] = useState(false);
  const { data: notes = [] } = useWikiIndexQuery(repoPath);

  const handleOpenWiki = useCallback(
    (name: string) => {
      const target = resolveWikiTarget(notes, name);
      if (target) onOpenNote(target);
      else setOpen(true);
    },
    [notes, onOpenNote]
  );

  return {
    notes,
    open,
    openPanel: () => setOpen(true),
    closePanel: () => setOpen(false),
    handleOpenWiki,
  };
}
