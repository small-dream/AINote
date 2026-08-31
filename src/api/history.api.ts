import { call } from "./client";
import type { CommitInfo, FileDiff } from "./types";

/** Git 版本历史 / Diff / 回滚 IPC（P1-1） */
export const historyApi = {
  /** 指定文件的提交历史（仅含修改过该文件的提交，时间倒序） */
  history: (file: string) => call<CommitInfo[]>("git_file_history", { file }),
  /** 选中提交相对其父提交的单文件 diff */
  diff: (file: string, commitId: string) =>
    call<FileDiff>("git_file_diff", { file, commitId }),
  /** 把文件恢复到指定提交版本（写入工作区） */
  restore: (file: string, commitId: string) =>
    call<null>("git_restore_file", { file, commitId }),
};
