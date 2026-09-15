import {
  useTaskCreateMutation,
  useTaskDeleteMutation,
  useTaskToggleMutation,
  useTaskUpdateMutation,
} from "@/queries/task.queries";

/** 待办面板共用的写用例集合与统一忙碌判定（任一变更为 pending 即锁定交互）。 */
export function useTaskMutations() {
  const create = useTaskCreateMutation();
  const update = useTaskUpdateMutation();
  const toggle = useTaskToggleMutation();
  const remove = useTaskDeleteMutation();
  const busy = create.isPending || update.isPending || toggle.isPending || remove.isPending;
  return { create, update, toggle, remove, busy };
}
