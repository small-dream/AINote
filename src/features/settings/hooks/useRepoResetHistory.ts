import { useMutation, useQueryClient } from "@tanstack/react-query";
import { repoApi } from "@/api";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { repoKeys } from "@/queries/repo.queries";

/**
 * 历史重置：破坏性操作，成功后仓库被换成全新的单提交历史，
 * 因此历史、同步与仓库大小等依赖旧 `.git` 的查询全部作废。
 */
export function useRepoResetHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      // 先落盘编辑器草稿：唯一那次提交取的是磁盘现状，未落盘的输入会落在提交之外
      await flushPendingDrafts();
      return repoApi.resetHistory(message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      void queryClient.invalidateQueries({ queryKey: ["repo-history"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
      void queryClient.invalidateQueries({ queryKey: ["history-diff"] });
      void queryClient.invalidateQueries({ queryKey: repoKeys.list });
    },
  });
}
