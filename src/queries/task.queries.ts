import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskApi, type CreateTaskInput, type UpdateTaskInput } from "@/api";
import { useWorkspaceActivityStore } from "@/stores/workspace-activity.store";
import { reportToastError } from "@/stores/toast.store";

/** Todo 看板（todos.json 快照，服务端/Git 状态权威来源） */
export function useTaskBoardQuery(repoPath: string | null) {
  return useQuery({
    queryKey: ["tasks", repoPath],
    queryFn: taskApi.board,
    enabled: repoPath !== null,
  });
}

function useTaskMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const markActivity = useWorkspaceActivityStore((state) => state.markActivity);
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      markActivity();
    },
    onError: reportToastError,
  });
}

export function useTaskCreateListMutation() {
  return useTaskMutation((name: string) => taskApi.createList(name));
}

export function useTaskRenameListMutation() {
  return useTaskMutation((input: { listId: string; name: string }) => taskApi.renameList(input.listId, input.name));
}

export function useTaskDeleteListMutation() {
  return useTaskMutation((listId: string) => taskApi.deleteList(listId));
}

export function useTaskCreateMutation() {
  return useTaskMutation((input: CreateTaskInput) => taskApi.create(input));
}

export function useTaskUpdateMutation() {
  return useTaskMutation((input: UpdateTaskInput) => taskApi.update(input));
}

export function useTaskToggleMutation() {
  return useTaskMutation((taskId: string) => taskApi.toggle(taskId));
}

export function useTaskDeleteMutation() {
  return useTaskMutation((taskId: string) => taskApi.remove(taskId));
}
