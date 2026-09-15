/** E2E mock：Todo 看板（todos.json）的内存实现，按 IPC 契约模拟 CRUD/toggle 语义。 */
import type { TaskBoardDto, TaskItemDto, TaskPriority } from "@/api/types";

export interface TaskStore {
  taskBoard: TaskBoardDto;
  taskSeq: number;
}

interface TaskCommandContext {
  store: TaskStore;
}

type TaskCommandHandler = (args: Record<string, unknown>, ctx: TaskCommandContext) => unknown;

function taskError(message: string): { code: string; kind: string; message: string; retriable: boolean } {
  return { code: "TASK_8001", kind: "Task", message, retriable: false };
}

function nowIso(): string {
  return new Date().toISOString();
}

function needTask(store: TaskStore, taskId: string) {
  const task = store.taskBoard.tasks.find((item) => item.id === taskId);
  if (!task) throw taskError(`task not found: ${taskId}`);
  return task;
}

function cleanTitle(args: Record<string, unknown>): string {
  const title = String(args.title ?? "").trim();
  if (!title) throw taskError("title is empty");
  return title;
}

function checkReminder(dueAt: string | null, remindAt: string | null): void {
  if (remindAt && !dueAt) throw taskError("remindAt requires dueAt");
}

function nullable(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function createTask(args: Record<string, unknown>, ctx: TaskCommandContext): TaskItemDto {
  const title = cleanTitle(args);
  const dueAt = nullable(args.dueAt);
  const remindAt = nullable(args.remindAt);
  checkReminder(dueAt, remindAt);
  const now = nowIso();
  const task: TaskItemDto = {
    id: `task-${ctx.store.taskSeq++}`,
    title,
    description: typeof args.description === "string" ? args.description : "",
    done: false,
    priority: (nullable(args.priority) ?? "none") as TaskPriority,
    dueAt,
    remindAt,
    sortOrder: ctx.store.taskBoard.tasks.length,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  ctx.store.taskBoard.tasks.push(task);
  return task;
}

function updateTask(args: Record<string, unknown>, ctx: TaskCommandContext): TaskItemDto {
  const task = needTask(ctx.store, String(args.taskId ?? ""));
  const title = cleanTitle(args);
  const dueAt = nullable(args.dueAt);
  const remindAt = nullable(args.remindAt);
  checkReminder(dueAt, remindAt);
  task.title = title;
  task.description = typeof args.description === "string" ? args.description : task.description;
  task.dueAt = dueAt;
  task.remindAt = remindAt;
  task.priority = (nullable(args.priority) ?? "none") as TaskPriority;
  task.updatedAt = nowIso();
  return task;
}

export const taskCommandHandlers: Record<string, TaskCommandHandler> = {
  task_board: (_args, ctx) => ctx.store.taskBoard,
  task_create: createTask,
  task_update: updateTask,
  task_toggle: (args, ctx) => {
    const task = needTask(ctx.store, String(args.taskId ?? ""));
    task.done = !task.done;
    task.completedAt = task.done ? nowIso() : null;
    task.updatedAt = nowIso();
    return task;
  },
  task_delete: (args, ctx) => {
    const taskId = String(args.taskId ?? "");
    needTask(ctx.store, taskId);
    ctx.store.taskBoard.tasks = ctx.store.taskBoard.tasks.filter((item) => item.id !== taskId);
    return null;
  },
};
