import { call } from "./client";
import type { RepoInfo, RepoPathDto, RepoSizeDto } from "./types";

/** 仓库管理相关 IPC（P0-1 / 设置-多仓库管理） */
export const repoApi = {
  /** 校验给定路径是否为可用 Git 仓库 */
  validate: (repoPath: string) => call<boolean>("validate_repo", { repoPath }),
  /** 绑定已有远端仓库：探测 → clone 到唯一目录 → 注册并设为活动仓库 */
  bind: (repoUrl: string) => call<RepoPathDto>("bind_repo", { repoUrl }),
  /** 在 GitHub 新建私有/公开仓库并绑定为活动仓库 */
  create: (name: string, isPrivate: boolean) =>
    call<RepoPathDto>("create_repo", { name, isPrivate }),
  /** 当前 config 中的活动 repoPath（未绑定为 null） */
  path: () => call<string | null>("get_repo_path"),
  /** 当前活动仓库的本地磁盘占用（字节） */
  size: () => call<RepoSizeDto>("get_repo_size"),
  /** 列出全部已绑定笔记仓库 */
  list: () => call<RepoInfo[]>("list_repos"),
  /** 重命名仓库展示名 */
  rename: (id: string, name: string) => call<null>("rename_repo", { id, name }),
  /** 移除仓库；返回移除后新的活动仓库路径（无仓库为 null） */
  remove: (id: string) => call<string | null>("remove_repo", { id }),
  /** 切换活动仓库；返回新活动仓库路径 */
  switchRepo: (id: string) => call<string>("switch_repo", { id }),
};
