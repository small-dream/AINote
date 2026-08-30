export { call } from "./client";
export { noteApi } from "./note.api";
export { repoApi } from "./repo.api";
export { syncApi } from "./sync.api";
export { authApi } from "./auth.api";
export { isAppError, messageOf } from "./error";
export type { AppError, ErrorKind } from "./error";
export type {
  AuthStatusDto,
  LoginDto,
  NodeKind,
  NoteContent,
  NoteMeta,
  RepoPathDto,
  SyncStatus,
  TreeNode,
} from "./types";
