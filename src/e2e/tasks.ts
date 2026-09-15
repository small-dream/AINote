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

function needList(store: TaskStore, listId: string) {
  const list = store.taskBoard.lists.find((item) => item.id === listId);
  if (!list) throw taskError(`list not found: ${listId}`);
  return list;
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

function checkReminder(dueDate: string | null, remindAt: string | null): void {
  if (remindAt && !dueDate) throw taskError("remindAt requires dueDate");
}

function nullable(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function createList(args: Record<string, unknown>, ctx: TaskCommandContext) {
  const name = String(args.name ?? "").trim();
  if (!name) throw taskError("list name is empty");
  const list = {
    id: `list-${ctx.store.taskSeq++}`,
    name,
    sortOrder: ctx.store.taskBoard.lists.length,
    createdAt: nowIso(),
  };
  ctx.store.taskBoard.lists.push(list);
  return list;
}

function createTask(args: Record<string, unknown>, ctx: TaskCommandContext): TaskItemDto {
  const listId = String(args.listId ?? "");
  needList(ctx.store, listId);
  const title = cleanTitle(args);
  const dueDate = nullable(args.dueDate);
  const remindAt = nullable(args.remindAt);
  checkReminder(dueDate, remindAt);
  const now = nowIso();
  const task: TaskItemDto = {
    id: `task-${ctx.store.taskSeq++}`,
    listId,
    title,
    done: false,
    priority: (nullable(args.priority) ?? "none") as TaskPriority,
    dueDate,
    remindAt,
    sortOrder: ctx.store.taskBoard.tasks.filter((item) => item.listId === listId).length,
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
  const listId = String(args.listId ?? task.listId);
  needList(ctx.store, listId);
  const dueDate = nullable(args.dueDate);
  const remindAt = nullable(args.remindAt);
  checkReminder(dueDate, remindAt);
  task.title = title;
  task.listId = listId;
  task.dueDate = dueDate;
  task.remindAt = remindAt;
  task.priority = (nullable(args.priority) ?? "none") as TaskPriority;
  task.updatedAt = nowIso();
  return task;
}

export const taskCommandHandlers: Record<string, TaskCommandHandler> = {
  task_board: (_args, ctx) => ctx.store.taskBoard,
  task_create_list: createList,
  task_rename_list: (args, ctx) => {
    const list = needList(ctx.store, String(args.listId ?? ""));
    const name = String(args.name ?? "").trim();
    if (!name) throw taskError("list name is empty");
    list.name = name;
    return null;
  },
  task_delete_list: (args, ctx) => {
    const listId = String(args.listId ?? "");
    needList(ctx.store, listId);
    ctx.store.taskBoard.lists = ctx.store.taskBoard.lists.filter((item) => item.id !== listId);
    ctx.store.taskBoard.tasks = ctx.store.taskBoard.tasks.filter((item) => item.listId !== listId);
    return null;
  },
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
