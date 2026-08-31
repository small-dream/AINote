export { call } from "./client";
export { noteApi } from "./note.api";
export { repoApi } from "./repo.api";
export { syncApi } from "./sync.api";
export { authApi } from "./auth.api";
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
  SyncStatus,
  TreeNode,
} from "./types";
