import type { TaskItemDto, TaskPriority } from "@/api/types";

/** 任务编辑草稿：行内编辑器、桌面详情面板与移动端全屏编辑面共用同一份字段集合。 */
export interface TaskDraft {
  title: string;
  description: string;
  dueAt: string | null;
  priority: TaskPriority;
  remindAt: string | null;
}

/** 提醒时刻只比较绝对时间，避免同一时刻的不同字符串形态被判成有改动。 */
function sameInstant(a: string | null, b: string | null): boolean {
  return (Date.parse(a ?? "") || 0) === (Date.parse(b ?? "") || 0);
}

export function taskToDraft(task: TaskItemDto): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    dueAt: task.dueAt,
    priority: task.priority,
    remindAt: task.remindAt,
  };
}

/** 提交口径：标题两端空白不进仓库，提醒不能脱离截止时间单独存在。 */
export function normalizeDraft(draft: TaskDraft): TaskDraft {
  return {
    title: draft.title.trim(),
    description: draft.description,
    dueAt: draft.dueAt,
    priority: draft.priority,
    remindAt: draft.dueAt ? draft.remindAt : null,
  };
}

/** 草稿是否与基准等价；标题按 trim 后比较，与提交口径一致，避免只多打一个空格就判成可保存。 */
export function sameDraft(a: TaskDraft, b: TaskDraft): boolean {
  const left = normalizeDraft(a);
  const right = normalizeDraft(b);
  return left.title === right.title
    && left.description === right.description
    && left.dueAt === right.dueAt
    && left.priority === right.priority
    && sameInstant(left.remindAt, right.remindAt);
}
