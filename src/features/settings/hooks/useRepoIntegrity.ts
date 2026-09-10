import { useMutation } from "@tanstack/react-query";
import { repoApi } from "@/api";

/** 仓库完整性检查：用户主动触发，不缓存结果（每次检查都应反映最新状态）。 */
export function useRepoIntegrity() {
  return useMutation({ mutationFn: () => repoApi.integrity() });
}
