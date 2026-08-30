/** 与 Rust 侧 domain/*.rs 的 DTO 保持结构一致（serde camelCase） */

/** list_notes / create_note 返回的笔记元数据 */
export interface NoteMeta {
  /** 相对仓库根目录的路径，如 "daily/2026-08-30.md" */
  path: string;
  title: string;
  updatedAt: number;
}

/** read_note 返回的完整笔记内容 */
export interface NoteContent {
  path: string;
  content: string;
}

/** note_tree 的节点类型：目录 / 文件 */
export type NodeKind = "file" | "dir";

/** note_tree 返回的文件树节点（children 仅 dir 非空） */
export interface TreeNode {
  name: string;
  path: string;
  nodeType: NodeKind;
  children: TreeNode[];
}

/** sync_status / sync_now / git_pull / git_push 返回的同步状态 */
export interface SyncStatus {
  ahead: number;
  behind: number;
  hasUncommitted: boolean;
  conflicted: boolean;
}

/** validate_token 返回 */
export interface LoginDto {
  login: string;
}

/** auth_status 返回 */
export interface AuthStatusDto {
  hasToken: boolean;
  repoPath: string | null;
}

/** bind_repo / create_repo 返回 */
export interface RepoPathDto {
  repoPath: string;
}
