/** 任务优先级（与 Rust domain/task.rs 一致） */
export type TaskPriority = "none" | "low" | "medium" | "high";

/** 单条任务；dueAt 为 YYYY-MM-DD（当天结束前）或 YYYY-MM-DDTHH:mm（本地具体时刻），时间戳为 RFC3339 */
export interface TaskItemDto {
  id: string;
  title: string;
  description: string;
  done: boolean;
  priority: TaskPriority;
  dueAt: string | null;
  remindAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** task_board 返回的整块 Todo 看板（todos.json 快照） */
export interface TaskBoardDto {
  schemaVersion: number;
  tasks: TaskItemDto[];
}
