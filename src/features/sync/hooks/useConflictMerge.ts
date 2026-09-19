import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictFile } from "@/api/types";
import {
  useConflictsQuery,
  usePushMutation,
  useResolveConflictMutation,
  useResolveFileMutation,
} from "@/queries/sync.queries";
import { appendLine } from "../utils/merge";

/** 单文件解决动作：整体保留本地 / 保留远端 / 保存手动编辑的合并结果 */
export type ConflictAction = "local" | "remote" | "merge";

/** 冲突面板阶段：加载中 / 加载失败 / 没有待处理文件 / 可合并 */
export type ConflictPhase = "loading" | "error" | "empty" | "ready";

/** 当前进行中的动作（用于按钮忙碌态）：单文件动作 / 批量 / 收尾推送 */
export type ConflictPending = ConflictAction | "all" | "push" | null;

/** 最近一次动作的参数：失败后「重试」按同一参数重发 */
type ConflictRun =
  | { kind: "file"; action: ConflictAction; path: string; content: string }
  | { kind: "bulk"; useLocal: boolean }
  | { kind: "push" };

/**
 * 冲突全部解决后自动 push 收尾：只在「本次打开期间确实解决过冲突」后触发一次。
 * 失败不自动重试——push 的失败状态变化会重跑 effect，自动重试会变成失败循环，
 * 收尾推送改由用户点「重试」。
 */
function useFinishPush(open: boolean, conflicts: ConflictFile[], onDone: () => void) {
  const push = usePushMutation();
  const hadConflicts = useRef(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!open) {
      hadConflicts.current = false;
      pushed.current = false;
      return;
    }
    if (conflicts.length > 0) {
      hadConflicts.current = true;
      return;
    }
    if (!hadConflicts.current || pushed.current) return;
    pushed.current = true;
    push.mutate(undefined, { onSuccess: onDone });
  }, [open, conflicts.length, push, onDone]);

  return push;
}

/** 当前文件 + 每文件合并文本的编辑状态（行级挑选 / 整段追加 / 手动编辑，P1-3） */
function useMergeEdits(conflicts: ConflictFile[], current: number) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const file = conflicts[Math.min(current, Math.max(conflicts.length - 1, 0))] ?? null;
  const merged = file ? (edits[file.path] ?? file.local) : "";

  const update = useCallback(
    (next: (prev: string) => string) => {
      if (!file) return;
      setEdits((prev) => ({ ...prev, [file.path]: next(prev[file.path] ?? file.local) }));
    },
    [file]
  );

  /** 解决成功后清掉该文件的编辑残留，避免同会话再次冲突时带出旧合并文本 */
  const clearEdit = useCallback((path: string) => {
    setEdits((prev) => {
      if (!(path in prev)) return prev;
      return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== path));
    });
  }, []);

  const setMerged = useCallback((value: string) => update(() => value), [update]);
  const addLine = useCallback((line: string) => update((prev) => appendLine(prev, line)), [update]);
  const appendAll = useCallback((lines: string[]) => update((prev) => lines.reduce(appendLine, prev)), [update]);

  return { file, merged, setMerged, addLine, appendAll, clearEdit };
}

type MergeEdits = ReturnType<typeof useMergeEdits>;
type PushMutation = ReturnType<typeof usePushMutation>;

/** 解决动作编排：单文件一键保留某一侧 / 批量保留 / 保存合并 / 收尾推送 + 失败重试 */
function useConflictRunner(edits: MergeEdits, push: PushMutation, onDone: () => void) {
  const resolveFile = useResolveFileMutation();
  const resolveAll = useResolveConflictMutation();
  const [pending, setPending] = useState<ConflictPending>(null);
  const last = useRef<ConflictRun | null>(null);

  const runFile = useCallback(
    (action: ConflictAction, path: string, content: string) => {
      last.current = { kind: "file", action, path, content };
      setPending(action);
      resolveFile.mutate({ path, content }, { onSettled: () => setPending(null), onSuccess: () => edits.clearEdit(path) });
    },
    [resolveFile, edits]
  );

  const runBulk = useCallback(
    (useLocal: boolean) => {
      last.current = { kind: "bulk", useLocal };
      setPending("all");
      resolveAll.mutate(useLocal, { onSettled: () => setPending(null), onSuccess: onDone });
    },
    [resolveAll, onDone]
  );

  const retryPush = useCallback(() => {
    last.current = { kind: "push" };
    setPending("push");
    push.mutate(undefined, { onSettled: () => setPending(null), onSuccess: onDone });
  }, [push, onDone]);

  const retry = useCallback(() => {
    const run = last.current;
    if (push.error || !run || run.kind === "push") {
      retryPush();
    } else if (run.kind === "bulk") {
      resolveAll.reset();
      runBulk(run.useLocal);
    } else {
      resolveFile.reset();
      runFile(run.action, run.path, run.content);
    }
  }, [push.error, resolveAll, resolveFile, retryPush, runBulk, runFile]);

  /** 一键解决当前文件：整体采用某一侧（加密笔记与三栏面板共用同一入口） */
  const resolveWithSide = useCallback(
    (side: "local" | "remote") => {
      if (!edits.file) return;
      runFile(side, edits.file.path, side === "local" ? edits.file.local : edits.file.remote);
    },
    [edits.file, runFile]
  );

  const saveMerge = useCallback(() => {
    if (!edits.file) return;
    runFile("merge", edits.file.path, edits.merged);
  }, [edits.file, edits.merged, runFile]);

  /** 没有冲突文件但仓库仍在合并态：完成 merge commit 并推送（空冲突集不会改写任何文件） */
  const finishMerge = useCallback(() => runBulk(true), [runBulk]);

  return {
    pending,
    keepAll: runBulk,
    resolveWithSide,
    saveMerge,
    finishMerge,
    retry,
    error: resolveFile.error ?? resolveAll.error ?? null,
  };
}

/** 冲突处理编排：冲突列表 + 当前文件 + 合并文本 + 解决动作 + 收尾（P1-3） */
export function useConflictMerge(repoPath: string | null, open: boolean, onDone: () => void) {
  const query = useConflictsQuery(repoPath, open);
  const conflicts = query.data ?? [];
  const push = useFinishPush(open, conflicts, onDone);
  /** 选中下标可能超出缩短后的列表：渲染期钳位，保证页签高亮始终落在当前文件上 */
  const [selected, setSelected] = useState(0);
  const current = Math.min(selected, Math.max(conflicts.length - 1, 0));
  const edits = useMergeEdits(conflicts, current);
  const runner = useConflictRunner(edits, push, onDone);

  /** 重试最近一次失败：列表加载失败重取，其余交给动作编排 */
  const retry = useCallback(() => {
    if (query.isError) {
      void query.refetch();
      return;
    }
    runner.retry();
  }, [query, runner]);

  const phase: ConflictPhase =
    repoPath === null || query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : conflicts.length === 0
          ? "empty"
          : "ready";

  return {
    conflicts,
    phase,
    loadError: query.error,
    error: runner.error ?? push.error ?? null,
    pending: runner.pending,
    file: edits.file,
    current,
    setCurrent: setSelected,
    merged: edits.merged,
    setMerged: edits.setMerged,
    addLine: edits.addLine,
    appendAll: edits.appendAll,
    resolveWithSide: runner.resolveWithSide,
    saveMerge: runner.saveMerge,
    keepAll: runner.keepAll,
    finishMerge: runner.finishMerge,
    retry,
    resolving: runner.pending !== null || push.isPending,
  };
}

/** 冲突面板编排结果：桌面与移动共用同一份状态，避免两套实现分叉。 */
export type ConflictMergeController = ReturnType<typeof useConflictMerge>;
