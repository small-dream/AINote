/** diff 行类型 */
export type DiffLineKind = "added" | "removed" | "context";

/** git_file_diff / git_working_diff 返回的单行（text 不含 +/- 前缀） */
export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

/** git_file_diff 返回：选中提交相对其父提交的单文件 diff */
export interface FileDiff {
  path: string;
  commitId: string;
  lines: DiffLine[];
}

/** git_working_diff 返回：待提交文件相对 HEAD 的改动（与 Rust domain/working_diff.rs 一致） */
export interface WorkingDiff {
  path: string;
  lines: DiffLine[];
  /** 二进制文件：不返回正文 */
  binary: boolean;
  /** 加密笔记：不返回密文 diff */
  encrypted: boolean;
  /** 改动过大，只返回前若干行 */
  truncated: boolean;
}
