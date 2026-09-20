/** 提交队列对外暴露的原始状态。 */
export type TaskSaveStatus = "idle" | "saving" | "saved" | "error";

/** 保存状态区实际展示的形态。 */
export type TaskSaveView = "unsaved" | "saving" | "saved" | "failed";

/**
 * 保存状态的展示口径：失败 > 保存中 > 有未保存改动 > 已保存 > 不显示。
 *
 * 失败与进行中必须压过「未保存」，否则用户看不到重试入口；而只要草稿还落后于已落盘内容，
 * 就不能用上一次的「已保存」糊弄过去。
 */
export function taskSaveView(dirty: boolean, status: TaskSaveStatus): TaskSaveView {
  if (status === "error") return "failed";
  if (status === "saving") return "saving";
  if (dirty) return "unsaved";
  // 卡片里的内容要么已落盘、要么待落盘，没有第三种状态：状态区因此常驻，
  // 与笔记工具栏的保存状态同一口径，用户不必先改点什么才知道这里会不会给反馈。
  return "saved";
}
