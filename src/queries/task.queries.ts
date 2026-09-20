import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskApi, type CreateTaskInput, type UpdateTaskInput } from "@/api";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";

/** Todo 看板（todos.json 快照，服务端/Git 状态权威来源） */
export function useTaskBoardQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["tasks", repoPath],
    queryFn: taskApi.board,
    enabled: repoPath !== null,
  });
}

function useTaskMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>, options?: { silentError?: boolean }) {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn,
    meta: { silentError: options?.silentError === true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // todos.json 落在仓库工作区，写入即产生待提交变更：即时刷新 [sync] 才能点亮待提交徽标。
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      markActivity();
    },
    // 错误上报交给全局 MutationCache.onError（providers.tsx）兜底，这里不再重复弹 toast
  });
}

export function useTaskCreateMutation() {
  return useTaskMutation((input: CreateTaskInput) => taskApi.create(input));
}

export function useTaskUpdateMutation() {
  return useTaskMutation((input: UpdateTaskInput) => taskApi.update(input));
}

/**
 * 编辑器自动保存专用的 task_update：错误交给编辑器内的保存状态区呈现（带重试），
 * 因此关掉全局 toast，避免同一次失败被报两遍。
 */
export function useTaskAutoSaveMutation() {
  return useTaskMutation((input: UpdateTaskInput) => taskApi.update(input), { silentError: true });
}

export function useTaskToggleMutation() {
  return useTaskMutation((taskId: string) => taskApi.toggle(taskId));
}

export function useTaskDeleteMutation() {
  return useTaskMutation((taskId: string) => taskApi.remove(taskId));
}
