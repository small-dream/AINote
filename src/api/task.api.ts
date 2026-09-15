import { call } from "./client";
import type { TaskBoardDto, TaskItemDto, TaskPriority } from "./types";

/** task_create 入参；dueAt/remindAt 可空 */
export interface CreateTaskInput {
  title: string;
  description: string;
  dueAt: string | null;
  priority: TaskPriority;
  remindAt: string | null;
}

/** task_update 入参：全量字段更新，总是携带完整可编辑状态 */
export interface UpdateTaskInput {
  taskId: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: TaskPriority;
  remindAt: string | null;
}

/** Todo 任务 IPC；todos.json 随仓库 Git 同步，变更走手动提交/同步兜底。 */
export const taskApi = {
  board: () => call<TaskBoardDto>("task_board"),
  create: (input: CreateTaskInput) => call<TaskItemDto>("task_create", { ...input }),
  update: (input: UpdateTaskInput) => call<TaskItemDto>("task_update", { ...input }),
  toggle: (taskId: string) => call<TaskItemDto>("task_toggle", { taskId }),
  remove: (taskId: string) => call("task_delete", { taskId }),
};
