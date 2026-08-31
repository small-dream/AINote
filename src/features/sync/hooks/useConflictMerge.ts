import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictFile } from "@/api/types";
import {
  useConflictsQuery,
  usePushMutation,
  useResolveConflictMutation,
  useResolveFileMutation,
} from "@/queries/sync.queries";
import { appendLine } from "../utils/merge";

/** 全部冲突解决（列表清空）后自动 push 收尾，避免每次渲染重复触发 */
function usePushWhenResolved(open: boolean, conflicts: ConflictFile[], onDone: () => void) {
  const push = usePushMutation();
  const hadConflicts = useRef(false);
  useEffect(() => {
    if (open && conflicts.length > 0) hadConflicts.current = true;
  }, [open, conflicts.length]);
  useEffect(() => {
    if (open && hadConflicts.current && conflicts.length === 0 && !push.isPending) {
      push.mutate(undefined, { onSuccess: onDone });
    }
  }, [open, conflicts.length, push, onDone]);
  return push.isPending;
}

/** 当前文件 + 每文件合并文本的编辑状态（行级挑选/保留侧，P1-3） */
function useMergeEdits(conflicts: ConflictFile[], current: number) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const file = conflicts[Math.min(current, Math.max(conflicts.length - 1, 0))] ?? null;
  const merged = file ? (edits[file.path] ?? file.local) : "";

  const setMerged = useCallback(
    (value: string) => {
      if (!file) return;
      setEdits((prev) => ({ ...prev, [file.path]: value }));
    },
    [file]
  );

  const addLine = useCallback(
    (line: string) => {
      if (!file) return;
      setEdits((prev) => ({ ...prev, [file.path]: appendLine(prev[file.path] ?? file.local, line) }));
    },
    [file]
  );

  const keepLocal = useCallback(() => {
    if (!file) return;
    setEdits((prev) => ({ ...prev, [file.path]: file.local }));
  }, [file]);

  const keepRemote = useCallback(() => {
    if (!file) return;
    setEdits((prev) => ({ ...prev, [file.path]: file.remote }));
  }, [file]);

  return { file, merged, setMerged, addLine, keepLocal, keepRemote };
}

/** 三栏合并编排：冲突文件列表 + 当前文件 + 每文件合并文本 + 解决/收尾（P1-3） */
export function useConflictMerge(repoPath: string | null, open: boolean, onDone: () => void) {
  const { data: conflicts = [], isLoading } = useConflictsQuery(repoPath, open);
  const resolveFile = useResolveFileMutation();
  const resolveAll = useResolveConflictMutation();
  const pushing = usePushWhenResolved(open, conflicts, onDone);
  const [current, setCurrent] = useState(0);
  const edits = useMergeEdits(conflicts, current);

  const saveMerge = useCallback(() => {
    if (!edits.file) return;
    resolveFile.mutate({ path: edits.file.path, content: edits.merged });
  }, [edits, resolveFile]);

  const keepAll = useCallback(
    (useLocal: boolean) => {
      resolveAll.mutate(useLocal, { onSuccess: onDone });
    },
    [resolveAll, onDone]
  );

  return {
    conflicts,
    isLoading,
    file: edits.file,
    current,
    setCurrent,
    merged: edits.merged,
    setMerged: edits.setMerged,
    addLine: edits.addLine,
    keepLocal: edits.keepLocal,
    keepRemote: edits.keepRemote,
    saveMerge,
    keepAll,
    resolving: resolveFile.isPending || pushing,
  };
}
