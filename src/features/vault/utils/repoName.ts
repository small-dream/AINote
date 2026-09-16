/** 仓库目录名：口令强度校验的上下文词（后端按同一口径校验一次）。 */
export function repoNameOf(repoPath: string | null): string {
  if (!repoPath) return "";
  const normalized = repoPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}
