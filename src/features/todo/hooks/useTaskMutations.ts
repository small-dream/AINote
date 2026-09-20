import {
  useTaskAutoSaveMutation,
  useTaskCreateMutation,
  useTaskDeleteMutation,
  useTaskToggleMutation,
  useTaskUpdateMutation,
} from "@/queries/task.queries";

/**
 * 待办面板共用的写用例集合与统一忙碌判定（任一变更为 pending 即锁定交互）。
 * `save` 是编辑器自动保存专用的 task_update：错误在编辑器内呈现，不计入 `busy`，避免打字时锁住输入。
 */
export function useTaskMutations() {
  const create = useTaskCreateMutation();
  const update = useTaskUpdateMutation();
  const save = useTaskAutoSaveMutation();
  const toggle = useTaskToggleMutation();
  const remove = useTaskDeleteMutation();
  const busy = create.isPending || update.isPending || toggle.isPending || remove.isPending;
  return { create, update, save, toggle, remove, busy };
}
