import { call } from "./client";

/** 仓库绑定相关 IPC（P0-1），Rust 命令就绪后填充实现 */
export const repoApi = {
  validate: (repoPath: string) => call<boolean>("validate_repo", { repoPath }),
};
