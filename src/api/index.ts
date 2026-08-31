export { call } from "./client";
export { noteApi } from "./note.api";
export { repoApi } from "./repo.api";
export { syncApi } from "./sync.api";
export { authApi } from "./auth.api";
export { searchApi } from "./search.api";
export { updateApi } from "./update.api";
export { isAppError, messageOf } from "./error";
export type { AppError, ErrorKind } from "./error";
export type {
  AuthStatusDto,
  LoginDto,
  NodeKind,
  NoteContent,
  NoteMeta,
  RepoInfo,
  RepoPathDto,
  SearchResult,
  SyncStatus,
  TreeNode,
} from "./types";
