import { call } from "./client";
import type { RepoPathDto } from "./types";

/** 仓库绑定相关 IPC（P0-1） */
export const repoApi = {
  /** 校验给定路径是否为可用 Git 仓库 */
  validate: (repoPath: string) => call<boolean>("validate_repo", { repoPath }),
  /** 绑定已有远端仓库：探测 → clone 到本地 → 写 config */
  bind: (repoUrl: string) => call<RepoPathDto>("bind_repo", { repoUrl }),
  /** 在 GitHub 新建私有/公开仓库并绑定 */
  create: (name: string, isPrivate: boolean) =>
    call<RepoPathDto>("create_repo", { name, isPrivate }),
  /** 当前 config 中的 repoPath（未绑定为 null） */
  path: () => call<string | null>("get_repo_path"),
};
