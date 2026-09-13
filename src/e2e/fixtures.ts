/** e2e 固定登录状态：默认平台已连接，便于直接进入工作区。 */
export const E2E_PROVIDERS = [
  {
    id: "github",
    displayName: "GitHub",
    hasToken: true,
    login: "e2e",
    tokenPage: "https://github.com/settings/tokens",
    supportsCreate: true,
  },
];

/** e2e 固定两个仓库：用于验证目录树顶部的仓库标识与切换（含移动端窄屏）。 */
export const E2E_REPOS = [
  { id: "/mock-repo", name: "Mock Repo", path: "/mock-repo", remoteUrl: "https://github.com/u/mock.git", providerId: "github" },
  { id: "/mock-repo-2", name: "备份库", path: "/mock-repo-2", remoteUrl: "https://gitee.com/u/backup.git", providerId: "gitee" },
];
