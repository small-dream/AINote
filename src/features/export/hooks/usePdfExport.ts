import { useCallback, useState } from "react";
import type { NoteKind } from "@/api/types";
import { noteDisplayName } from "@/features/note/utils/displayName";

interface UsePdfExportOptions {
  notePath: string | null;
  kind: NoteKind;
  repoPath: string | null;
  /** 打开打印预览前先落盘（保存失败不阻断导出当前草稿） */
  flush: () => Promise<void> | void;
}

/** 导出 PDF（打印）编排：打开/关闭全屏打印预览。 */
export function usePdfExport({ notePath, kind, repoPath, flush }: UsePdfExportOptions) {
  const [open, setOpen] = useState(false);

  const request = useCallback(async () => {
    try {
      await flush();
    } catch {
      // 导出使用内存中最新草稿，保存失败不阻断
    }
    setOpen(true);
  }, [flush]);

  const close = useCallback(() => setOpen(false), []);
  const name = notePath?.split("/").at(-1) ?? "";
  const title = noteDisplayName(name);
  return { open, title, kind, repoPath, request, close };
}
