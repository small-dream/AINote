/** 与 Rust 侧 domain/*.rs 的 DTO 保持结构一致（serde camelCase） */

/** 笔记类型：Markdown 源码 / 真富文本（TipTap JSON，`.ainote`） */
export type NoteKind = "markdown" | "richText";

/** list_notes / create_note 返回的笔记元数据 */
export interface NoteMeta {
  /** 相对仓库根目录的路径，如 "daily/2026-08-30.md" */
  path: string;
  kind: NoteKind;
  title: string;
  updatedAt: number;
}

/** read_note 返回的完整笔记内容 */
export interface NoteContent {
  path: string;
  kind: NoteKind;
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

/** list_conflicts 返回：单个冲突文件的三栏合并素材（与 Rust domain/sync.rs 一致） */
export interface ConflictFile {
  /** 相对仓库根目录的路径，如 "daily/a.md" */
  path: string;
  /** 本地侧内容（index stage 2） */
  local: string;
  /** 远端侧内容（index stage 3） */
  remote: string;
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

/** search_notes 返回的单条搜索结果（与 Rust domain/search.rs 一致） */
export interface SearchResult {
  /** 相对仓库根目录的路径，如 "daily/2026-08-30.md" */
  path: string;
  title: string;
  /** 首个命中行附近的上下文片段 */
  snippet: string;
  /** 首个命中所在行号（1 起） */
  line: number;
  updatedAt: number;
}

/** git_file_history 返回的单条提交（与 Rust domain/history.rs 一致） */
export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  author: string;
  /** 提交时间（Unix 秒） */
  timestamp: number;
}

/** diff 行类型 */
export type DiffLineKind = "added" | "removed" | "context";

/** git_file_diff 返回的单行（text 不含 +/- 前缀） */
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

/** import_asset / import_asset_bytes 返回：资产在仓库中的相对路径 */
export interface AssetInfo {
  path: string;
}

/** wiki_index 返回的单篇笔记（与 Rust domain/wiki.rs 一致） */
export interface NoteWikiDto {
  /** 相对仓库根目录的路径，如 "daily/2026-08-30.md" */
  path: string;
  title: string;
  /** 内容中提取的标签（已去重、小写归一化） */
  tags: string[];
  /** 内容中 [[双链]] 目标（已去重，保留原始书写） */
  links: string[];
  /** 双链所在行的简短上下文，用于反向链接预览。 */
  linkContexts?: WikiLinkContext[];
}

export interface WikiLinkContext {
  target: string;
  snippet: string;
}

/** list_repos 返回的单仓库信息 */
export interface RepoInfo {
  id: string;
  /** 展示名（可重命名） */
  name: string;
  /** 本地克隆路径 */
  path: string;
  /** 远端 HTTPS 地址（bind 时记录） */
  remoteUrl: string | null;
}

/** trash_list 返回：回收站条目（与 Rust domain/trash.rs 一致） */
export interface TrashItem {
  /** 唯一标识 */
  id: string;
  /** 删除前的原始相对路径（恢复目标） */
  path: string;
  /** 删除时间（Unix 秒） */
  deletedAt: number;
  /** 删除时解析的笔记标题 */
  title: string;
}
