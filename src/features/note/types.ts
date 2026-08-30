/** 与 Rust 侧 domain/note.rs 的 NoteMeta 保持结构一致（serde camelCase） */
export interface NoteMeta {
  /** 相对仓库根目录的路径，如 "daily/2026-08-30.md" */
  path: string;
  title: string;
  updatedAt: number;
}
